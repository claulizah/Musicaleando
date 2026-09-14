import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad — Musicaleando',
  description: 'Cómo Musicaleando recaba, usa y protege tus datos personales.',
};

// Contenido final de producto (no un placeholder técnico) — provisto
// completo salvo los campos [PLACEHOLDER] que dependen de entidad
// legal/RFC y correo de contacto definitivos. No reemplazar esos
// marcadores con valores inventados; solo Claudia los completa.
export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-sm leading-relaxed text-gray-700">
      <h1 className="text-2xl font-semibold text-gray-900">Aviso de Privacidad — Musicaleando</h1>
      <p className="mt-1 text-gray-500">
        Última actualización: <span className="text-amber-600">[PLACEHOLDER: fecha de publicación]</span>
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <section>
          <h2 className="font-medium text-gray-900">1. Quiénes somos</h2>
          <p className="mt-1">
            Musicaleando es operado por{' '}
            <span className="text-amber-600">
              [PLACEHOLDER: nombre de la persona física o razón social]
            </span>
            . Para cualquier duda sobre este aviso de privacidad o sobre tus datos personales,
            puedes contactarnos en{' '}
            <span className="text-amber-600">
              [PLACEHOLDER: correo de contacto de privacidad, ej. privacidad@musicaleando.com]
            </span>
            .
          </p>
          <p className="mt-2">
            Este aviso se emite conforme a la Ley Federal de Protección de Datos Personales en
            Posesión de los Particulares (LFPDPPP) y su Reglamento.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">2. Qué datos recabamos</h2>
          <p className="mt-1">Al usar Musicaleando podemos recabar:</p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              <b>Datos de cuenta:</b> correo electrónico y contraseña (almacenada de forma
              cifrada, nunca en texto plano).
            </li>
            <li>
              <b>Perfil musical:</b> género(s) favoritos, artistas, y respuestas al cuestionario
              de perfil musical express.
            </li>
            <li>
              <b>Actividad dentro de la app:</b> mood del día que compartes, festivales en los
              que marcas interés (&quot;FestivalIntent&quot;), squads a los que te unes,
              interacciones con anuncios y promociones.
            </li>
            <li>
              <b>Ubicación aproximada (ciudad):</b> para mostrarte contenido relevante de tu
              zona y para que los patrocinadores puedan segmentar promociones por ciudad,
              siempre de forma agregada (ver sección 4).
            </li>
            <li>
              <b>Datos técnicos:</b> información del dispositivo y datos de uso necesarios para
              el funcionamiento y seguridad de la app.
            </li>
          </ul>
          <p className="mt-2">
            No recabamos datos sensibles en el sentido de la LFPDPPP (salud, origen étnico,
            creencias religiosas, etc.) como parte del funcionamiento normal de la app.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">3. Para qué usamos tus datos</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>Crear y administrar tu cuenta y tu perfil dentro de la app.</li>
            <li>
              Mostrarte recomendaciones y contenido relevante (mood del día, festivales,
              squads).
            </li>
            <li>
              Permitir la operación del Festival Hub, incluyendo la compra de boletos hacia
              terceros cuando aplica.
            </li>
            <li>Moderar contenido y mantener la seguridad de la comunidad.</li>
            <li>
              Generar reportes agregados y anónimos para patrocinadores (ver sección 4 — esto
              no implica compartir tus datos individuales).
            </li>
            <li>Cumplir obligaciones legales cuando aplique.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">
            4. Datos y patrocinadores: qué compartimos y qué nunca compartimos
          </h2>
          <p className="mt-1">Este es un punto que tomamos en serio y queremos ser explícitos:</p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Los patrocinadores nunca ven tu nombre, tu correo, ni ninguna lista de usuarios
              individuales.
            </li>
            <li>
              Cuando un patrocinador segmenta una promoción o un anuncio (por ejemplo, por
              ciudad o por género musical dominante), el sistema solo le muestra un conteo
              agregado de cuántas personas caen en ese segmento.
            </li>
            <li>
              Si un segmento resultaría en menos de 30 a 50 usuarios, el sistema bloquea
              automáticamente la publicación de esa promoción — no se genera ni se muestra
              ningún dato que pudiera identificar a un grupo tan pequeño de personas.
            </li>
            <li>
              Los datos de seguridad de la cuenta (contraseñas, tokens de sesión, etc.) nunca
              se comparten con patrocinadores bajo ninguna circunstancia.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">5. Con quién compartimos datos</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Proveedores de infraestructura (por ejemplo, nuestro proveedor de base de datos y
              autenticación) que procesan datos en nuestro nombre bajo obligaciones de
              confidencialidad.
            </li>
            <li>
              Terceros de boletaje (por ejemplo, Ticketmaster) únicamente cuando decides
              comprar un boleto a través de un enlace del Festival Hub — en ese caso, sales de
              Musicaleando y quedas sujeto al aviso de privacidad de ese tercero.
            </li>
            <li>
              Patrocinadores, únicamente en forma de conteos agregados y anónimos, conforme a
              la sección 4.
            </li>
            <li>No vendemos tus datos personales a terceros.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">6. Tus derechos (ARCO)</h2>
          <p className="mt-1">
            Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte (derechos ARCO) al
            tratamiento de tus datos personales, así como a revocar tu consentimiento en
            cualquier momento. Para ejercer estos derechos, escríbenos a{' '}
            <span className="text-amber-600">[PLACEHOLDER: correo de contacto de privacidad]</span>{' '}
            indicando tu solicitud; te responderemos en los plazos que marca la LFPDPPP.
          </p>
          <p className="mt-2">
            También puedes eliminar tu cuenta directamente desde la app en{' '}
            <span className="text-amber-600">
              [PLACEHOLDER: ruta/menú donde vive la opción de eliminar cuenta, si ya existe — o
              &quot;próximamente&quot; si aún no está construida]
            </span>
            .
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">7. Seguridad de tus datos</h2>
          <p className="mt-1">
            Aplicamos medidas administrativas, técnicas y físicas razonables para proteger tus
            datos personales contra daño, pérdida, alteración, destrucción o uso no
            autorizado.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">8. Cambios a este aviso</h2>
          <p className="mt-1">
            Podemos actualizar este aviso de privacidad. Si hacemos cambios importantes, lo
            notificaremos dentro de la app o publicando la nueva versión en esta misma página
            con su fecha de actualización.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">9. Contacto</h2>
          <p className="mt-1">
            Para dudas, solicitudes o quejas relacionadas con tus datos personales:{' '}
            <span className="text-amber-600">[PLACEHOLDER: correo de contacto de privacidad]</span>.
          </p>
        </section>
      </div>

      <Link href="/" className="mt-10 inline-block text-sm underline">
        ← Volver
      </Link>
    </main>
  );
}
