'use client';

import { useEffect, useTransition, useState } from 'react';
import { triggerSiteDeploy } from './deploy-actions';

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'hace un momento';
  if (mins === 1) return 'hace 1 minuto';
  if (mins < 60) return `hace ${mins} minutos`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return 'hace 1 hora';
  if (hours < 24) return `hace ${hours} horas`;
  return new Date(iso).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCooldown(ms: number): string {
  const secs = Math.ceil(ms / 1000);
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
}

export function RepublishSiteButton({ initialLastTriggeredAt }: { initialLastTriggeredAt: string | null }) {
  const [lastTriggeredAt, setLastTriggeredAt] = useState(initialLastTriggeredAt);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // "hace X minutos" solo se calcula en el cliente, después de montar — el
  // mismo valor calculado en el server-render y de nuevo en el primer
  // render del cliente puede no coincidir si pasa un minuto entre ambos
  // (mismatch de hidratación real, visto en Sentry). null = todavía no
  // montó, se renderiza vacío en vez de arriesgar un valor que no cuadre;
  // se recalcula cada 30s para que no quede pegado en el momento del montaje.
  const [relativeText, setRelativeText] = useState<string | null>(null);

  useEffect(() => {
    if (!lastTriggeredAt) {
      queueMicrotask(() => setRelativeText(null));
      return;
    }
    const update = () => setRelativeText(formatRelative(lastTriggeredAt));
    // Deferred a un microtask en vez de llamarse directo en el cuerpo del
    // efecto — mismo resultado (corre antes del siguiente paint), pero sin
    // el setState síncrono que react-hooks/set-state-in-effect marca como
    // riesgo de renders en cascada.
    queueMicrotask(update);
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [lastTriggeredAt]);

  const handleClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await triggerSiteDeploy();
      if (result.ok) {
        setLastTriggeredAt(result.triggeredAt);
        setMessage({
          kind: 'success',
          text: 'Rebuild disparado — sigue el progreso en la pestaña Actions de GitHub si quieres, o espera ~1-2 minutos.',
        });
        return;
      }
      if (result.reason === 'cooldown') {
        setMessage({
          kind: 'error',
          text: `Espera ${formatCooldown(result.cooldownRemainingMs)} antes de disparar otro rebuild.`,
        });
        return;
      }
      setMessage({ kind: 'error', text: result.message });
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="whitespace-nowrap rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Disparando…' : '🚀 Republicar sitio'}
      </button>
      {message && (
        <p className={`max-w-[16rem] text-right text-xs ${message.kind === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
      {!message && relativeText && (
        <p className="text-xs text-gray-400">Último rebuild: {relativeText}</p>
      )}
    </div>
  );
}
