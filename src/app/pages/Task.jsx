import TaskPage from '../../components/TaskPage.jsx';

// Rendered for every /tasks/:id URL; the component reads the id from the URL.
export default function Task() {
	return (
		<div className="cl-container">
			<TaskPage />
		</div>
	);
}
