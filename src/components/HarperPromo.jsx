import { useEffect, useState } from 'react';
import harperMark from '../assets/harper-mark.svg?url';

/**
 * Subtle "Built on Harper" promo, pinned bottom-right — the hosting partner's
 * marketing presence for the event. Dismissable, and the dismissal is
 * remembered across visits (localStorage) so it never nags. Hidden until
 * mounted: the dismissal state lives in localStorage, which the server render
 * cannot see, so appearing after hydration is what keeps the markup stable.
 */
const DISMISS_KEY = 'cl.harperPromoDismissed';
const HARPER_URL = 'https://harper.fast/start';

export default function HarperPromo() {
	const [dismissed, setDismissed] = useState(true);

	useEffect(() => {
		try {
			setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
		} catch {
			setDismissed(false);
		}
	}, []);

	if (dismissed) return null;

	function dismiss() {
		try {
			localStorage.setItem(DISMISS_KEY, '1');
		} catch {
			/* private mode / storage disabled — just hide for this session */
		}
		setDismissed(true);
	}

	return (
		<aside className="cl-harper-promo" aria-label="Built on Harper">
			<button
				type="button"
				className="cl-harper-promo-close"
				aria-label="Dismiss"
				onClick={dismiss}
			>
				×
			</button>
			<img src={harperMark} alt="" width={40} height={40} />
			<div>
				<div className="cl-harper-promo-title">Built on Harper</div>
				<a href={HARPER_URL} target="_blank" rel="noopener noreferrer">
					Try now →
				</a>
			</div>
		</aside>
	);
}
