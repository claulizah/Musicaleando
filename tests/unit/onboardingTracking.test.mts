import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_STEPS,
  PASO_BIENVENIDA,
  PASO_COMPLETO,
  createOnboardingTracker,
  pasoDeQuiz,
} from '../../src/lib/onboardingTracking.ts';
import {
  MIN_USUARIOS_PARA_CONCLUIR,
  ONBOARDING_STEPS as ADMIN_STEPS,
  buildFunnel,
} from '../../admin/src/lib/onboardingFunnel.ts';

const tick = () => new Promise((r) => setImmediate(r));

test('15 pasos numerados sin huecos; el quiz ocupa del 2 al 11', () => {
  assert.deepEqual(ONBOARDING_STEPS.map((s) => s.paso), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(pasoDeQuiz(0), 2);
  assert.equal(pasoDeQuiz(9), 11);
  assert.equal(PASO_BIENVENIDA, 1);
  assert.equal(PASO_COMPLETO, 15);
  assert.equal(new Set(ONBOARDING_STEPS.map((s) => s.nombre)).size, 15, 'nombres únicos');
});

test('la lista de pasos del admin es idéntica a la de la app', () => {
  assert.deepEqual(ADMIN_STEPS, ONBOARDING_STEPS);
});

test('registra usuario, paso y nombre', async () => {
  const sent: [string, number, string][] = [];
  const track = createOnboardingTracker((u, p, n) => void sent.push([u, p, n]));
  track('u1', 3);
  await tick();
  assert.deepEqual(sent, [['u1', 3, 'quiz_02_generos']]);
});

test('NO hace esperar al onboarding: aunque el envío nunca responda, regresa al instante', () => {
  let started = 0;
  const hanging = () => {
    started++;
    return new Promise<never>(() => {}); // una red que jamás contesta
  };
  const track = createOnboardingTracker(hanging);
  const t0 = process.hrtime.bigint();
  const ret = track('u1', 2);
  const micros = Number(process.hrtime.bigint() - t0) / 1000;
  assert.equal(ret, undefined, 'no devuelve promesa: nadie puede esperarla');
  assert.equal(started, 1);
  assert.ok(micros < 5000, `debe regresar en microsegundos, tardó ${micros}µs`);
});

test('un envío que falla o lanza no rompe el onboarding', async () => {
  const boom = createOnboardingTracker(() => Promise.reject(new Error('sin red')));
  assert.doesNotThrow(() => boom('u1', 2));
  const throws = createOnboardingTracker(() => {
    throw new Error('sincrónico');
  });
  assert.doesNotThrow(() => throws('u1', 2));
  await tick();
});

test('cada (usuario, paso) se manda una sola vez; volver atrás y avanzar no repite', async () => {
  let calls = 0;
  const track = createOnboardingTracker(() => void calls++);
  track('u1', 4);
  track('u1', 4);
  track('u1', 5);
  track('u2', 4);
  await tick();
  assert.equal(calls, 3);
});

test('si un envío falla se reintenta la próxima vez que llega a ese paso', async () => {
  let calls = 0;
  const track = createOnboardingTracker(() => {
    calls++;
    return calls === 1 ? { error: 'rls' } : undefined;
  });
  track('u1', 6);
  await tick();
  track('u1', 6);
  await tick();
  track('u1', 6);
  await tick();
  assert.equal(calls, 2, 'reintenta una vez y, ya enviado, deja de mandar');
});

test('sin usuario o con un paso inexistente no manda nada', async () => {
  let calls = 0;
  const track = createOnboardingTracker(() => void calls++);
  track(null, 2);
  track(undefined, 2);
  track('u1', 99);
  await tick();
  assert.equal(calls, 0);
});

// Embudo de ejemplo: monótono, como lo entrega la base (llegaron a N = paso máximo >= N).
// La mayor pérdida está en el paso 2 (Quiz 1): 92 llegan, solo 58 pasan al Quiz 2.
const ejemplo = [100, 92, 58, 55, 53, 50, 49, 46, 43, 42, 40, 36, 34, 30, 28].map((llegaron, i) => ({ paso: i + 1, llegaron }));

test('embudo: llegaron, % del inicio, cuántos se fueron en cada paso y su %', () => {
  const f = buildFunnel(ejemplo);
  assert.equal(f.empezaron, 100);
  assert.equal(f.completaron, 28);
  assert.equal(f.pctCompletaron, 28);
  const paso1 = f.rows[0];
  assert.deepEqual([paso1.llegaron, paso1.pctDelInicio, paso1.seFueronAqui, paso1.pctAbandonoAqui], [100, 100, 8, 8]);
  const paso14 = f.rows[13]; // ubicación: 30 llegaron, 28 terminaron -> 2 se fueron aquí
  assert.deepEqual([paso14.llegaron, paso14.seFueronAqui, paso14.pctAbandonoAqui], [30, 2, 6.7]);
  const ultimo = f.rows[14];
  assert.deepEqual([ultimo.seFueronAqui, ultimo.pctAbandonoAqui], [null, null], 'el último paso no tiene "siguiente"');
});

test('embudo: señala el paso con más gente perdida', () => {
  const f = buildFunnel(ejemplo);
  assert.equal(f.pasoMasAbandono?.paso, 2);
  assert.equal(f.pasoMasAbandono?.seFueronAqui, 34);
  assert.equal(f.pasoMasAbandono?.etiqueta, 'Quiz 1 · Duelo visual');
});

test('embudo: avisa del poco volumen (pocos usuarios no permiten concluir)', () => {
  assert.equal(buildFunnel(ejemplo).pocoVolumen, false, '100 usuarios alcanzan');
  const pocos = buildFunnel(ejemplo.map((r) => ({ ...r, llegaron: Math.round(r.llegaron / 10) })));
  assert.equal(pocos.empezaron, 10);
  assert.equal(pocos.pocoVolumen, true);
  assert.ok(MIN_USUARIOS_PARA_CONCLUIR > 10);
});

test('embudo vacío: todo en cero, sin porcentajes ni paso culpable', () => {
  const f = buildFunnel([]);
  assert.equal(f.empezaron, 0);
  assert.equal(f.pctCompletaron, null);
  assert.equal(f.pasoMasAbandono, null);
  assert.equal(f.pocoVolumen, true);
  assert.ok(f.rows.every((r) => r.pctDelInicio === null && r.pctAbandonoAqui === null));
});
