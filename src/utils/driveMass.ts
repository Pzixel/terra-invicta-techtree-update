import type { ModuleTemplate } from "../types";

type DriveMassInputs = Pick<
    ModuleTemplate,
    "flatMass_tons" | "thrust_N" | "EV_kps" | "specificPower_kgMW"
>;

/** Mirrors TIDriveTemplate.buildMass_tons in the game. */
export function calculateDriveMassTons(drive: DriveMassInputs): number {
    const flatMassTons = drive.flatMass_tons ?? 0;
    const thrustPowerGW = (drive.thrust_N ?? 0) * (drive.EV_kps ?? 0) * 0.5 / 1_000_000;
    return flatMassTons + thrustPowerGW * (drive.specificPower_kgMW ?? 0);
}

export function hasDriveMass(drives: DriveMassInputs[]): boolean {
    return drives.some(drive => calculateDriveMassTons(drive) > 0);
}
