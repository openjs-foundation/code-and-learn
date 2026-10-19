import GlowingBackdrop from '@node-core/ui-components/Common/GlowingBackdrop';
import PoolMosaic from '../../components/PoolMosaic.jsx';
import TaskDirectory from '../../components/TaskDirectory.jsx';

export default function Home() {
	return (
		<div className="cl-container">
			<header className="cl-page-head">
				<div className="cl-glow">
					<GlowingBackdrop />
				</div>
				<h1>Make your first Node.js contribution today.</h1>
				<p className="cl-lede">
					Every cell below is a real, mentored task on the Node.js project, and the green ones are
					open. Claim one, then watch the wall fill in as pull requests go up.
				</p>
				<PoolMosaic />
			</header>
			<TaskDirectory />
		</div>
	);
}
