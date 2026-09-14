import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Musicaleando',
  description: 'Términos y condiciones de uso de la aplicación Musicaleando.',
};

// Contenido final de producto (no un placeholder técnico). Todos los datos
// legales/de contacto ya están llenos salvo la ruta de eliminar cuenta,
// pendiente a propósito hasta que esa función exista en producción.
// Nota: el texto original traía un link externo roto a
// "https://claude.ai/privacidad" (artefacto de dónde se redactó) — se
// corrigió a un link interno real hacia /privacidad.
export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-sm leading-relaxed text-gray-700">
      <h1 className="text-2xl font-semibold text-gray-900">Términos y Condiciones — Musicaleando</h1>
      <p className="mt-1 text-gray-500">
        Última actualización: 14 de septiembre de 2026
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <section>
          <h2 className="font-medium text-gray-900">1. Aceptación de los términos</h2>
          <p className="mt-1">
            Al crear una cuenta o usar Musicaleando (&quot;la App&quot;), operada por Claudia
            Acosta Hernández, aceptas estos Términos y Condiciones y nuestro{' '}
            <Link href="/privacidad" className="underline">
              Aviso de Privacidad
            </Link>
            . Si no estás de acuerdo, no debes usar la App.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">2. Qué es Musicaleando</h2>
          <p className="mt-1">
            Musicaleando es una aplicación para descubrir tu perfil musical, compartir tu mood
            del día, formar squads con amigos, y descubrir e interesarte en festivales y
            conciertos a través del Festival Hub, incluyendo enlaces de compra de boletos hacia
            terceros.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">3. Requisitos para usar la App</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Debes contar con al menos 18 años para crear una cuenta.
            </li>
            <li>
              Eres responsable de mantener la confidencialidad de tu contraseña y de toda
              actividad realizada desde tu cuenta.
            </li>
            <li>
              La información que proporciones (perfil, mood, etc.) debe ser veraz y no debe
              suplantar a otra persona.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">4. Conducta del usuario</h2>
          <p className="mt-1">Al usar Musicaleando te comprometes a no:</p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              Publicar contenido ilegal, difamatorio, discriminatorio o que incite a la
              violencia.
            </li>
            <li>
              Acosar, amenazar o vulnerar a otros usuarios dentro de squads o cualquier función
              social de la App.
            </li>
            <li>Intentar vulnerar la seguridad de la App o acceder a cuentas ajenas.</li>
            <li>
              Usar la App para fines comerciales no autorizados (por ejemplo, publicar anuncios
              propios fuera del mecanismo de patrocinios de la plataforma).
            </li>
          </ul>
          <p className="mt-2">
            Musicaleando puede moderar, remover contenido, o suspender cuentas que violen estos
            términos.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">5. Festival Hub y compra de boletos</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>
              La información de festivales y conciertos que se muestra en la App proviene de
              fuentes curadas y/o de integraciones con terceros (por ejemplo, Ticketmaster).
            </li>
            <li>
              Al hacer clic en &quot;comprar boletos&quot; saldrás de Musicaleando hacia el
              sitio del proveedor de boletaje correspondiente. La compra, el pago, la entrega
              del boleto y cualquier disputa relacionada son responsabilidad exclusiva de ese
              tercero — Musicaleando no vende boletos ni procesa pagos directamente.
            </li>
            <li>
              Los precios mostrados (cuando están disponibles) son de referencia y pueden no
              reflejar cargos adicionales del proveedor de boletaje; el precio final se
              confirma en el sitio del tercero.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">6. Patrocinios y promociones</h2>
          <p className="mt-1">
            Los anuncios, rifas o descuentos mostrados dentro de la App pueden estar dirigidos
            a segmentos de usuarios según ciudad o género musical, conforme a lo descrito en
            nuestro{' '}
            <Link href="/privacidad" className="underline">
              Aviso de Privacidad
            </Link>
            . Participar en una promoción de un patrocinador puede sujetarte también a los
            términos propios de ese patrocinador, que se te mostrarán al momento de participar.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">7. Propiedad intelectual</h2>
          <p className="mt-1">
            El contenido, marca, logotipos y diseño de Musicaleando son propiedad de Claudia
            Acosta Hernández o de sus licenciantes. El contenido que tú publiques (como tu mood del día) sigue
            siendo tuyo, pero nos otorgas una licencia limitada para mostrarlo dentro de la App
            conforme a su funcionalidad normal.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">8. Limitación de responsabilidad</h2>
          <p className="mt-1">
            Musicaleando se ofrece &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No
            garantizamos que la información de festivales, precios o disponibilidad de boletos
            esté siempre actualizada o libre de errores. En la medida permitida por la ley
            aplicable, no somos responsables por daños indirectos derivados del uso de la App o
            de transacciones realizadas con terceros a través de ella.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">9. Suspensión y cancelación de cuenta</h2>
          <p className="mt-1">
            Podemos suspender o cancelar tu cuenta si violas estos términos. Tú puedes eliminar
            tu cuenta en cualquier momento desde{' '}
            <span className="text-amber-600">
              [PENDIENTE: se documentará una vez publicada la pantalla de Configuración/Cuenta con
              la opción de eliminar cuenta]
            </span>
            .
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">10. Cambios a estos términos</h2>
          <p className="mt-1">
            Podemos actualizar estos Términos y Condiciones. Los cambios importantes se
            notificarán dentro de la App o publicando la nueva versión en esta página con su
            fecha de actualización.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">11. Ley aplicable</h2>
          <p className="mt-1">
            Estos términos se rigen por las leyes de los Estados Unidos Mexicanos.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900">12. Contacto</h2>
          <p className="mt-1">
            Dudas sobre estos términos:{' '}
            <a href="mailto:clauliz.acosta@gmail.com" className="underline">
              clauliz.acosta@gmail.com
            </a>
            .
          </p>
        </section>
      </div>

      <Link href="/" className="mt-10 inline-block text-sm underline">
        ← Volver
      </Link>
    </main>
  );
}
