import { EQNodeData } from './utils';

export interface CalibrationPreset {
  id: string;
  name: string;
  nodes: EQNodeData[];
  globalGain?: number;
}

export class CalibrationManager {
  private static PRESETS_KEY = 'eq_trainer_calibration_presets';
  private static ACTIVE_KEY = 'eq_trainer_calibration_active';

  static getPresets(): CalibrationPreset[] {
    const data = localStorage.getItem(this.PRESETS_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  static savePreset(preset: CalibrationPreset) {
    const presets = this.getPresets();
    const existingIndex = presets.findIndex(p => p.id === preset.id);
    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }
    localStorage.setItem(this.PRESETS_KEY, JSON.stringify(presets));
  }

  static deletePreset(id: string) {
    let presets = this.getPresets();
    presets = presets.filter(p => p.id !== id);
    localStorage.setItem(this.PRESETS_KEY, JSON.stringify(presets));
    if (this.getActivePresetId() === id) {
      this.setActivePresetId(null);
    }
  }

  static getActivePresetId(): string | null {
    return localStorage.getItem(this.ACTIVE_KEY);
  }

  static setActivePresetId(id: string | null) {
    if (id) {
      localStorage.setItem(this.ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(this.ACTIVE_KEY);
    }
  }

  static getActivePreset(): CalibrationPreset | null {
    const activeId = this.getActivePresetId();
    if (!activeId) return null;
    return this.getPresets().find(p => p.id === activeId) || null;
  }
}
