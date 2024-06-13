import { Bot } from 'grammy';

type DayCapacityAvailability = {
	available: number;
	total: number;
};

type DayCapacity = {
	day: string;
	availability: DayCapacityAvailability;
};

type ApiResponse = {
	availableDays: string[];
	capacityPerDay: DayCapacity[];
};

const APPOINTMENT_API = 'https://api.enviso.io/ticketwidgetapi/v3/salespoints/271/offers/4803/availabledays';
const API_KEY_HEADER = 'X-Api-Key';
const ORDER_URL = 'https://www.annefrank.org/en/museum/tickets/choose-your-ticket/tickets-regular/';

const encodeGetParams = (p: object) =>
	Object.entries(p)
		.map((kv) => kv.map(encodeURIComponent).join('='))
		.join('&');

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log('Received request, starting');
		const botInfo = JSON.parse(env.BOT_INFO);
		const bot = new Bot(env.TELEGRAM_BOT_TOKEN, { botInfo });

		const from_date_str = await env.STORAGE.get('from_date');
		if (!from_date_str) throw new Error("Couldn't get from_date value");
		const from_date = new Date(from_date_str);
		const to_date_str = await env.STORAGE.get('to_date');
		if (!to_date_str) throw new Error("Couldn't get from_date value");
		const to_date = new Date(to_date_str);

		const appointmentDates = await getAppointmentDates(env, from_date, to_date);
		const availableDates = appointmentDates
			.filter((dayCapacity) => dayCapacity.availability.available > 0)
			.map((dayCapacity) => dayCapacity.day);
		if (availableDates.length > 0) {
			const chatIds = await getChatIds(env);
			await Promise.all(chatIds.map((chatId) => bot.api.sendMessage(chatId, prepareMessage(availableDates), { parse_mode: 'HTML' })));
		}
	},
};

async function getAppointmentDates(env: Env, from_date: Date, to_date: Date): Promise<DayCapacity[]> {
	const params = {
		from_date: from_date.toISOString().split('T')[0],
		to_date: to_date.toISOString().split('T')[0],
		quantity: 0,
	};

	console.log('Fetching new appointment dates');
	const response = await fetch(`${APPOINTMENT_API}?${encodeGetParams(params)}`, {
		headers: {
			[API_KEY_HEADER]: env.ENVISO_API_KEY,
		},
	});
	const { capacityPerDay }: ApiResponse = (await response.json()) as ApiResponse;
	return capacityPerDay;
}

async function getChatIds(env: Env): Promise<number[]> {
	try {
		const data = await env.STORAGE.get('active_chat_ids');
		return data ? JSON.parse(data) : [];
	} catch (e) {
		if (e instanceof Error) console.error(`Error getting chat IDs - ${e.message}`);
		return [];
	}
}

function prepareMessage(availableDates: string[]): string {
	let response = 'Found available dates: \n';
	for (const date of response) {
		response += `${date}\n`;
	}
	response += `Click <a href='${ORDER_URL}'>here</a> to order!`;
	return response;
}
