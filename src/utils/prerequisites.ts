import { prerequisiteSlots } from '../data/scenarioCompiler';
import type { TechTemplate } from '../types';

export function selectedPrerequisiteTechs(
  record: TechTemplate,
  lookup: (dataName: string) => TechTemplate | null | undefined,
): TechTemplate[] {
  return prerequisiteSlots(record).flatMap((slot) => {
    const options = slot.flatMap((dataName) => {
      const tech = lookup(dataName);
      return tech ? [tech] : [];
    });
    if (options.length === 0) return [];
    return [options.find((tech) => tech.researchDone) ?? options[0]];
  });
}
