import { LuSun, LuMoon } from 'react-icons/lu';
import { useThemeStore } from '../../stores/themeStore';

/**
 * Dark mode toggle button — inline version for use inside headers.
 * No fixed positioning — parent controls placement.
 */
export default function DarkModeToggle({ size = 38 }) {
  const { isDark, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: isDark ? '1.5px solid #30363d' : '1.5px solid #e2e8f0',
        background: isDark
          ? 'linear-gradient(135deg, #161b22, #21262d)'
          : 'linear-gradient(135deg, #ffffff, #f1f5f9)',
        color: isDark ? '#fbbf24' : '#64748b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.4)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.borderColor = isDark ? '#fbbf24' : '#0d9488';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.borderColor = isDark ? '#30363d' : '#e2e8f0';
      }}
    >
      {isDark
        ? <LuSun  size={size * 0.45} strokeWidth={2} />
        : <LuMoon size={size * 0.45} strokeWidth={2} />
      }
    </button>
  );
}
