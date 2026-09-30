import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const applyTheme = (dark) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
};

export const useThemeStore = create(
  persist(
    (set, get) => ({
      isDark: false,

      toggleTheme: () => {
        const next = !get().isDark;
        set({ isDark: next });
        applyTheme(next);
      },

      initTheme: () => {
        applyTheme(get().isDark);
      },
    }),
    {
      name: 'theme-store',
      partialize: (state) => ({ isDark: state.isDark }),
    }
  )
);
