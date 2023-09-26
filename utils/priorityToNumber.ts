export const priorityToNumber = (priority: string): number => {
	const priorityMap: { [key: string]: number } = {
		Urgent: 3,
		High: 2,
		Medium: 1,
		Low: 0,
	};
	return priorityMap[priority] || 0;
};
