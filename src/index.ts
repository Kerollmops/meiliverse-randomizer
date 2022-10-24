/**
 * Welcome to Cloudflare Workers! This is your first scheduled worker.
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler publish --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
}

export default {
	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		let base_url = "https://discord.com/api/v10";
		let limit = 100;
		let validate_emoji = '✅';
		let upvote_emoji = '👍';

		// We fetch all the messages of this channel
		// But not the ones that where not ✅ by $VALIDATOR_USER_ID
		var weighted_pictures: [WeightedMessage] = [];
		var last_message_id = null;
		while (true) {
			let msgs_init = { headers: { 'authorization': `Bot ${env.DISCORD_TOKEN}` } };
			let before = "";
			if (last_message_id) { before = `&before=${last_message_id}` }

			let url = `${base_url}/channels/${env.DISCORD_CHANNEL_ID}/messages?limit=${limit}${before}`;
			const messages = await fetch(url, msgs_init).then(res => (res.json() as Message[]));
			for (var message of messages) {
				if (message.attachments.length != 0) {
					// TODO get trully all reactions
					let emoji = encodeURI(validate_emoji);
					let url = `${base_url}/channels/${env.DISCORD_CHANNEL_ID}/messages/${message.id}/reactions/${emoji}`;
					let users = await fetch(url, msgs_init).then(res => (res.json() as User[]));
					await new Promise(f => setTimeout(f, 1000)); // wait 1 second
					const is_admin = (user) => user.id === env.VALIDATOR_USER_ID;

					if (Array.isArray(users) && users.some(is_admin)) {
						// Find the number of upvotes for the attachements
						const found = message.reactions.find(r => { return r.emoji.name === upvote_emoji });
						let weight = 1;
						if (found) { weight = weight + found.count }

						for (var attachment of message.attachments) {
							weighted_pictures.push({ weight, url: attachment.proxy_url });
						}
					}
				}
			}

			// Stop the loop when out of posts
			let last = messages.at(-1);
			if (last) { last_message_id = last.id } else { break }
		}

		// Generate a flat array with every single pictures correctly weighted
		// The score is the fibonacci output of the number of original weight.
		var flat_pictures: [String] = [];
		for (var weighted_picture of weighted_pictures) {
			for (var _i = 0; _i < fibonacci(weighted_picture.weight); _i++) {
				flat_pictures.push(weighted_picture.url);
			}
		}

		let random_number = Math.floor(Math.random() * flat_pictures.length);
		let chosen_picture = flat_pictures[random_number];

		let dus_init = { headers: { 'x-auth-token': env.SCALEWAY_DATAURISCHEME_TOKEN } };
		const url = `https://meiliverserandomizerczcjdz5c-dataurischeme.functions.fnc.fr-par.scw.cloud/?url=${chosen_picture}`;
		const data_uri_scheme = await fetch(url, dus_init).then(response => response.text());

		let disc_init = {
			method: 'PATCH',
			headers: {
				'authorization': `Bot ${env.DISCORD_TOKEN}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify({ 'icon': data_uri_scheme })
		}
		let output = await fetch(`${base_url}/guilds/${env.DISCORD_GUILD_ID}`, disc_init).then(response => response.text());
		console.log(output);
	},
};

type Message = {
	id: String;
	attachments: [Attachment];
}

type Attachment = {
	proxy_url: String;
}

type User = {
	id: String;
}

type WeightedPicture = {
	weight: Number;
	url: String;
}

function fibonacci(num) {
	if (num <= 1) {
		return 1;
	}

	return fibonacci(num - 1) + fibonacci(num - 2);
}
