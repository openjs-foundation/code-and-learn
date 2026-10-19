import Shell from '../components/Shell.jsx';
import SiteFooter from '../components/SiteFooter.jsx';
import HarperPromo from '../components/HarperPromo.jsx';
import AnnouncementBox from '../components/AnnouncementBox.jsx';

/*
THESIS: The workshop's live pulse leads; the room watches itself work. Refuses the
static catalog-with-sidebar directory default.
OWN-WORLD: nodejs.org design system via @node-core/ui-components. Open Sans body,
IBM Plex Mono for data, brand green #417e38 (#84ba64 dark) as sole accent, neutral
grays, 1px hairline borders, light/dark via data-theme. Task pool rendered as a live
mosaic of status cells: green open, amber held, deep-green filled done.
STORY: an attendee sees the room moving, filters to what fits them, claims one task,
ships a PR, watches their cell fill in.
FIRST VIEWPORT: NavBar; title + one-line offer; full-width live pool mosaic with
legend counts; filter bar; top of the worklist. Primary action: pick a task row.
*/

// The page frame around every route: skip link, nav, announcement, footer,
// and the Harper promo. Rendered on the server by entry-server and hydrated
// whole by entry-client.
export default function App({ route, pathname, children }) {
	return (
		<>
			<a href="#main" className="cl-skip">
				Skip to content
			</a>
			<Shell pathname={pathname} />
			<main id="main">
				{route.announcement ? (
					<div className="cl-container">
						<AnnouncementBox />
					</div>
				) : null}
				{children}
			</main>
			<SiteFooter pathname={pathname} />
			<HarperPromo />
		</>
	);
}
