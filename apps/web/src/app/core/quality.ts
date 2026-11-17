import { classify, compassDirection, describeBrightness, describeElevation, type QualityClass } from '@ceu/sky-engine/astro';
import type { PassDetails, SkyEvent } from './models';

export interface QualityView {
  cls: QualityClass;
  label: string;
  index: number;
  /** Frase curta sobre o céu: chance, nunca garantia. */
  sky: string;
}
const LABELS: Record<QualityClass, string> = { excelente: 'Excelente', boa: 'Boa', dificil: 'Difícil', oculta: 'Muito difícil' };

export function qualityOf(e: SkyEvent): QualityView {
  const decided = e.decision !== null;
  const index = Math.round(decided ? e.decision!.index : e.geometryScore);
  // Sem decisão ainda, classifica pela geometria; com decisão por elementos velhos, idem.
  const cls = classify(decided && e.decision!.reason === 'elementos_velhos' ? e.geometryScore : index);
  let sky = 'A previsão de nuvens sai cerca de 2 horas antes.';
  if (decided) {
    const r = e.decision!.reason;
    if (r === 'sem_previsao') sky = 'Sem previsão de nuvens no momento.';
    else if (r === 'nuvens') sky = 'A previsão é de céu encoberto.';
    else if (r === 'elementos_velhos') sky = 'Horário a confirmar: aguardando dados novos da órbita.';
    else sky = cls === 'excelente' ? 'Chance ótima de céu aberto.' : cls === 'boa' ? 'Chance boa de céu aberto.' : 'Céu incerto.';
  }
  return { cls, label: LABELS[cls], index, sky };
}

export const isGood = (e: SkyEvent) => ['excelente', 'boa'].includes(qualityOf(e).cls);

/** "Aparece a noroeste e sobe até ficar quase no topo do céu." */
export function whereToLook(p: PassDetails): string {
  const from = compassDirection(p.start.az);
  const to = compassDirection(p.end.az);
  const first = p.startsInShadow
    ? `Surge do nada a ${from}, ${describeElevation(p.start.el)}, ao sair da sombra da Terra`
    : `Aparece a ${from} e sobe até ficar ${describeElevation(p.peak.el)}`;
  const last = p.endsInShadow ? `Some no meio do céu, a ${to}, ao entrar na sombra da Terra.` : `Desce em direção a ${to}.`;
  return `${first}. ${last}`;
}
export const brightness = (p: PassDetails) => describeBrightness(p.magnitude);
export const minutes = (p: PassDetails) => Math.max(1, Math.round(p.durationSeconds / 60));
export { compassDirection, describeElevation };
