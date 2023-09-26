const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24;

function calculateDaysDifference(date1: any, date2: any) {
	return Math.round((date1 - date2) / MILLISECONDS_IN_A_DAY);
}

export async function FormatDateForDisplay(dateString: string) {
	const today: Date = new Date();
	today.setHours(0, 0, 0, 0);
	const inputDate: Date = new Date(dateString);

	const daysDifference = calculateDaysDifference(inputDate, today);

	const dayNames = [
		'Dimanche',
		'Lundi',
		'Mardi',
		'Mercredi',
		'Jeudi',
		'Vendredi',
		'Samedi',
	];

	if (daysDifference < 0) {
		return 'En retard';
	} else if (daysDifference === 0) {
		return "Aujourd'hui";
	} else if (daysDifference === 1) {
		return 'Demain';
	} else if (daysDifference < 7) {
		return dayNames[inputDate.getDay()];
	} else {
		return `${daysDifference} jours`;
	}
}
