import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Eliminar mi cuenta — Musicaleando',
  description: 'Cómo eliminar tu cuenta de Musicaleando y qué datos se borran.',
};

// Página de solicitud de eliminación de cuenta. Google Play pide, además del
// flujo dentro de la app, una URL pública donde se explique cómo pedir la
// eliminación (se declara en el formulario de Seguridad de los datos). La
// eliminación real vive en la app (Perfil > Configuración > Eliminar mi
// cuenta, función delete-account); esta página describe ese camino y ofrece
// el correo para quien ya no tiene la app instalada. Copia idéntica en
// admin/src/app/eliminar-cuenta/page.tsx (el portal que sirve musicaleando.com).
export default function EliminarCuentaPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-sm leading-relaxed text-gray-700">
      <h1 className="text-2xl font-semibold text-gray-900">Eliminar mi cuenta — Musicaleando</h1>
      <p className="mt-1 text-gray-500">Última actualización: 21 de septiembre de 2026</p>

      <div className="mt-8 flex flex-col gap-6">
        <section>
          <h2 className="font-medium text-gray-900">Desde la app (inmediato)</h2>
          <p className="mt-1">
            Es la forma más rápida y no necesitas contactarnos. Musicaleando no usa correo ni contraseña: tu cuenta
            es una sesión anónima de tu dispositivo, y se elimina desde ahí:
          </p>
          <ol className="mt-2 list-decimal pl-5">
            <li>Abre Musicaleando y entra a tu <b>Perfil</b>.</li>
            <li>Toca el ícono de engranaje (<b>Configuración</b>).</li>
            <li>En &quot;Zona de peligro&quot;, toca <b>Eliminar mi cuenta</b>.</li>
            <li>Escribe <b>ELIMINAR</b> para confirmar.</li>
          </ol>
          <p className="mt-2">
            La eliminación es permanente e inmediata: no hay periodo de gracia ni forma de recuperar tus datos.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">Qué se elimina</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>Tu perfil musical (géneros, respuestas del cuestionario, estados de interés) y tu estado.</li>
            <li>Tu historial de moods, tus insignias, tus tendencias y tus recomendaciones.</li>
            <li>Tus marcas de &quot;Voy&quot; / &quot;Tal vez&quot; en eventos, reseñas y encuestas.</li>
            <li>Tus membresías de squad y tus votos; los squads que creaste pasan a otro integrante o se borran si
              no queda nadie.</li>
            <li>Tu álbum de conciertos, incluidas las fotos que subiste.</li>
            <li>Tus solicitudes de contacto, tus avisos vistos y tu avance en el onboarding.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">Qué se conserva, sin ligarse a ti</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Tus comentarios y reacciones en eventos y las canciones que compartiste en Tendencias permanecen
              visibles para no romper la conversación, pero se muestran como &quot;Usuario eliminado&quot;.
            </li>
            <li>
              Los clics que hiciste en &quot;Comprar boletos&quot; se conservan como estadística, sin ningún
              identificador tuyo.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">Si ya no tienes la app o tu teléfono</h2>
          <p className="mt-1">
            Como no hay correo ni contraseña, la cuenta se identifica por su <b>ID de cuenta</b> (lo ves en la app,
            en Configuración). Escríbenos a{' '}
            <a href="mailto:clauliz.acosta@gmail.com?subject=Eliminar%20mi%20cuenta" className="underline">
              clauliz.acosta@gmail.com
            </a>{' '}
            con el asunto &quot;Eliminar mi cuenta&quot; y ese ID, y eliminaremos tus datos; te responderemos en los
            plazos que marca la LFPDPPP. Sin el ID no podemos ubicar tu cuenta con certeza, porque tus datos no
            están ligados a tu nombre ni a tu correo.
          </p>
        </section>

        <p>
          Más detalles en el{' '}
          <Link href="/privacidad" className="underline">
            Aviso de Privacidad
          </Link>
          .
        </p>
      </div>

      <Link href="/" className="mt-10 inline-block text-sm underline">
        ← Volver
      </Link>
    </main>
  );
}
