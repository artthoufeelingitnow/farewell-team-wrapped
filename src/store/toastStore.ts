import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (msg: string) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (msg) => {
    set({ message: msg });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set({ message: null }), 2200);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ message: null });
  },
}));

export function showToast(msg: string): void {
  useToastStore.getState().show(msg);
}
