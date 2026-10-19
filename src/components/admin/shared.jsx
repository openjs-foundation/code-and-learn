// Bits shared by more than one admin tab.
import { useEffect, useState } from 'react';
import { getJson } from '../../lib/api.js';

export const DIFFICULTY_BADGE = { beginner: 'default', intermediate: 'warning', advanced: 'error' };

// Same casing as the directory rows and the task page ("Beginner", not "beginner").
export function titleCase(value) {
	return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export const STATUS_TEXT = {
	available: 'Open',
	claimed: 'In progress',
	completed: 'Done',
	flagged: 'In review',
	uncompletable: 'Removed',
};

export function formatWhen(timestamp) {
	if (!timestamp) return '';
	return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Everyone who has signed in, for the assign/credit/promote suggestion
// dropdowns. Loaded once per tab mount; typing a login that has not signed in
// yet still works — the datalist only suggests.
export function useParticipants() {
	const [participants, setParticipants] = useState([]);
	useEffect(() => {
		getJson('/api/admin/participants')
			.then((data) => setParticipants(data.participants ?? []))
			.catch(() => {});
	}, []);
	return participants;
}

export function ParticipantDatalist({ id, participants }) {
	return (
		<datalist id={id}>
			{participants.map((person) => (
				<option key={person.login} value={person.login}>
					{person.name && person.name !== person.login ? person.name : undefined}
				</option>
			))}
		</datalist>
	);
}
