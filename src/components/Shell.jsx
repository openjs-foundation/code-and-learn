import { useEffect, useState } from 'react';
import NavBar from '@node-core/ui-components/Containers/NavBar';
import NodejsLogo from '@node-core/ui-components/Common/NodejsLogo';
import ThemeToggle from '@node-core/ui-components/Common/ThemeToggle';
import BaseButton from '@node-core/ui-components/Common/BaseButton';
import GitHub from '@node-core/ui-components/Icons/Social/GitHub';
import { getJson, signInHref, signOut } from '../lib/api.js';
import { storedTheme, setTheme, watchSystemTheme } from '../lib/theme.js';
import DevSignInMenu from './DevSignInMenu.jsx';

export default function Shell({ pathname }) {
	const [themePreference, setThemePreference] = useState('system');
	const [me, setMe] = useState(undefined); // undefined = loading, null = signed out
	const [devSignIn, setDevSignIn] = useState(false);

	useEffect(() => {
		setThemePreference(storedTheme());
		return watchSystemTheme();
	}, []);

	useEffect(() => {
		getJson('/api/me')
			.then((data) => {
				setMe(data?.user ?? null);
				setDevSignIn(Boolean(data?.devSignIn));
			})
			.catch(() => setMe(null));
	}, []);

	const navItems = [
		{ text: 'Tasks', link: '/' },
		{ text: 'My task', link: '/me' },
		{ text: 'Guide', link: '/setup' },
	];
	if (me?.isAdmin) navItems.push({ text: 'Admin', link: '/admin' });

	return (
		<NavBar
			as="a"
			pathname={pathname}
			navItems={navItems}
			Logo={NodejsLogo}
			sidebarItemTogglerAriaLabel="Toggle navigation menu"
		>
			<ThemeToggle
				currentTheme={themePreference}
				onChange={(next) => {
					setThemePreference(next);
					setTheme(next);
				}}
				ariaLabel="Switch color theme"
			/>
			{devSignIn ? <DevSignInMenu currentLogin={me?.login} /> : null}
			{me === undefined ? null : me === null ? (
				<BaseButton as="a" href={signInHref()} size="small">
					<GitHub width={16} height={16} aria-hidden="true" />
					Sign in with GitHub
				</BaseButton>
			) : (
				<span className="cl-signin-cta">
					{me.avatarUrl ? (
						<img className="cl-avatar" src={me.avatarUrl} alt="" width="28" height="28" />
					) : null}
					<span>{me.login}</span>
					<button type="button" className="cl-btn-quiet" onClick={signOut}>
						Sign out
					</button>
				</span>
			)}
		</NavBar>
	);
}
