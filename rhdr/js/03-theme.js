(function (global) {
  'use strict';

  const App = global.AbsensiApp = global.AbsensiApp || {};
  const { THEME_KEY, THEMES } = App.CONFIG;

  App.getSavedTheme = function getSavedTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
    } catch (_) {
      return THEMES.LIGHT;
    }
  };

  App.getThemeIcon = function getThemeIcon(theme) {
    if (theme === THEMES.DARK) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v2.5M12 18.5V21M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M3 12h2.5M18.5 12H21M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3c-.02.27-.03.54-.03.81A7 7 0 0 0 20.19 12c.27 0 .54-.01.81-.03Z"/></svg>';
  };

  App.applyTheme = function applyTheme(theme, persist = true) {
    const nextTheme = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
    document.documentElement.setAttribute('data-theme', nextTheme);
    App.dom.themeToggleLabel.textContent = nextTheme === THEMES.DARK ? 'Light mode' : 'Dark mode';
    App.dom.themeToggleIcon.innerHTML = App.getThemeIcon(nextTheme);
    if (persist) {
      try { localStorage.setItem(THEME_KEY, nextTheme); } catch (_) {}
    }
  };

  App.toggleTheme = function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || THEMES.LIGHT;
    App.applyTheme(current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);
  };

  App.currentTheme = function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  };
})(window);
