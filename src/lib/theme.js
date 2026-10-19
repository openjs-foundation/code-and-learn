// Theme handling shared by the inline boot script and the ThemeToggle island.
// The stored preference is 'system' | 'light' | 'dark'; the resolved theme is
// stamped on <html data-theme> so @node-core/ui-components' dark styles apply.

const STORAGE_KEY = 'cl-theme';

export function storedTheme() {
	if (typeof localStorage === 'undefined') return 'system';
	const value = localStorage.getItem(STORAGE_KEY);
	return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(preference) {
	if (preference === 'light' || preference === 'dark') return preference;
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference) {
	document.documentElement.dataset.theme = resolveTheme(preference);
}

export function setTheme(preference) {
	if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
	else localStorage.setItem(STORAGE_KEY, preference);
	applyTheme(preference);
}

export function watchSystemTheme() {
	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const onChange = () => {
		if (storedTheme() === 'system') applyTheme('system');
	};
	media.addEventListener('change', onChange);
	return () => media.removeEventListener('change', onChange);
}
