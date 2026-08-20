import { create } from 'zustand';
import type { JobApplication } from '../types';

type ModalType = 'prep' | 'tailor' | 'outreach' | null;

interface UIState {
  activeModal: ModalType;
  activeApp: JobApplication | null;
  openModal: (type: ModalType, app?: JobApplication) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  activeApp: null,
  openModal: (type, app = null) => set({ activeModal: type, activeApp: app }),
  closeModal: () => set({ activeModal: null, activeApp: null }),
}));
