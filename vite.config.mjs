// @ts-check
// Vite 8 (rolldown) config. The app runs inside Harper via @harperfast/vite:
// `harper dev .` serves this with HMR on Harper's own port, and `harper run .`
// builds it (client + SSR bundles) and renders HTML per navigation — see
// config.yaml. No dev proxy needed: the API, OAuth, and the frontend share
// one origin.
import { defineConfig, defaultClientConditions, defaultServerConditions } from 'vite';
import react from '@vitejs/plugin-react';
import { uiComponentsResolver } from './config/ui-components-resolver.mjs';
import { setupCommandsPlugin } from './config/setup-commands.mjs';

export default defineConfig({
	plugins: [react(), uiComponentsResolver, setupCommandsPlugin()],
	resolve: {
		// 'rolldown' steers @node-core/ui-components' `#ui/*` imports map to
		// compiled dist/ output instead of raw TSX source.
		conditions: [...defaultClientConditions, 'rolldown'],
	},
	ssr: {
		// 'harper' must resolve to the running Harper runtime, never be
		// bundled — node_modules/harper is a symlink to the host install and
		// symlinked deps are not reliably auto-externalized for SSR.
		external: ['harper'],
		noExternal: ['@node-core/ui-components'],
		resolve: {
			conditions: [...defaultServerConditions, 'rolldown'],
		},
	},
	build: {
		outDir: 'dist',
		// One stylesheet for the whole app, linked from the document head. The
		// SSR'd markup uses the design system's hashed CSS-module classes, so
		// every page must have all component styles before its JS chunk
		// arrives; per-chunk CSS would leave server-rendered markup unstyled
		// until hydration. JS stays code-split — this only merges CSS.
		cssCodeSplit: false,
	},
	optimizeDeps: {
		// Prebundle the design-system components (and, through them, Radix,
		// heroicons, and classnames) so dev serves a handful of dep chunks
		// instead of the package's raw per-file modules.
		include: [
			'@node-core/ui-components/Common/AlertBox',
			'@node-core/ui-components/Common/Badge',
			'@node-core/ui-components/Common/BaseButton',
			'@node-core/ui-components/Common/BaseCodeBox',
			'@node-core/ui-components/Common/CodeTabs',
			'@node-core/ui-components/Common/GlowingBackdrop',
			'@node-core/ui-components/Common/NodejsLogo',
			'@node-core/ui-components/Common/Select',
			'@node-core/ui-components/Common/Skeleton',
			'@node-core/ui-components/Common/Switch',
			'@node-core/ui-components/Common/Tabs',
			'@node-core/ui-components/Common/ThemeToggle',
			'@node-core/ui-components/Containers/Footer',
			'@node-core/ui-components/Containers/NavBar',
			'@node-core/ui-components/Icons/Social/GitHub',
		],
	},
});
