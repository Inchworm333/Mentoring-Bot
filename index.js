// Using dotenv to read a .env file for the secret infos
require('dotenv').config()

// Regular imports
const { PerformanceObserver, performance } = require('perf_hooks');
const Discord = require('discord.js');
const client = new Discord.Client();
const events = {
	MESSAGE_REACTION_ADD: 'messageReactionAdd',
	MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
}

// Lists
let createdChannels = [];
let online_mentor_afk_list = []

// Mentoring Variables
const mentoring_times = "10 am - 6 pm Monday through Friday";

// Set the bot's presence (activity and status)
client.on("ready", () => {
  client.user.setPresence({
  	activity: {
      name: 'Mentoring Assistance',
    },
    status: 'Online'
  })
})

client.on('raw', async event => {
	if (!events.hasOwnProperty(event.t)) return;
	const { d: data } = event;
	const user = client.users.cache.get(data.user_id);
	const channel = client.channels.cache.get(data.channel_id) || await user.createDM();
	if (channel.messages.cache.has(data.message_id)) return;
	const message = await channel.messages.fetch(data.message_id);
	const emojiKey = (data.emoji.id) ? `${data.emoji.name}:${data.emoji.id}` : data.emoji.name;
	const reaction = message.reactions.cache.get(emojiKey);
	client.emit(events[event.t], reaction, user);
});

client.on('message', async msg => {
	// Ensuring we aren't responding to a bot
	if (msg.author.bot) return;

	// Load the roles active on the server
	let mentor_role = msg.guild.roles.cache.find(role => role.name === "Mentor")
	let online_role = msg.guild.roles.cache.find(role => role.name === "Online Mentor")
	let social_role = msg.guild.roles.cache.find(role => role.name === "Social")

	// Get member roles
	let mentor = false;
	let online = false;
	msg.member.roles.cache.forEach((key, value) => {
		if (value === mentor_role.id) {
			mentor = true;
		} else if (value === online_role.id) {
			online = true;
		}
	});

	// See if a mentor returned from being afk
	if (online && online_mentor_afk_list.length) {
		let index = online_mentor_afk_list.findIndex((afk_mentor) => msg.author === afk_mentor.name)
		if(index !== -1) {
			online_mentor_afk_list.splice(index, 1)
			msg.channel.send(`${msg.author} has returned to their keyboard. They will be right with you :hugging::raised_hands:`)
		}
	}

	//Commands that can be run at any time outside of mentoring hours
	if (msg.content.toLowerCase().startsWith("!help")) {
		let mentor_cmds;
		if (mentor) {
			mentor_cmds = `
				Mentor-Only commands:
				${quote`
					${inline`!online`} -> Sets your status so you appear as the current mentor on duty
					${inline`!offline`} -> Removes your status as the current mentor on duty
					${inline`!brb`} {optional: [minutes until return]} -> Notifies any mentees that use !ping that you are afk and returning soon
					${inline`!sos`} -> In case of emergency, request help from another mentor
					${inline`!close`} -> Removes all existing voice and text channels
					Note: All commands work for you 24/7. Before 10 and after 6 mentees can't run commands
				`}
			`
		}

		msg.channel.send(`
			Hi ${msg.author}, welcome to the eSSE's mentoring system! We're here to help.
			Here's a few helpful commands:
			${quote`
				${inline`!help`} -> See this command (but you knew that already)
				${inline`!ping`} -> Make mentors aware you need help (Please use discretion, there may only be one mentor online at a time)
				${inline`!join`} -> Enters you in private voice and chat channels to speak one-on-one with a mentor
				${inline`!social`} -> Allows you to see our discord social chats! Anyone can chat at any time and its way less serious than the rest of the mentoring discord
			`}
			${mentor_cmds}
			Please remember the following items:
			${quote`
				We are volunteers (we don't get paid)
				Our hours are ${mentoring_times}
				We are an official RIT organization. PLEASE no profanity, harassment, sexual comments, or anything else made to mentors or other mentees
				If you are overly aggressive to our mentors or break any of the rules above, you will be banned permanently and you will be reported to RIT
			`}
			*If you would like to mute this channel to prevent being spammed with notifications, right click on the channel in the navigation bar to the left, navigate to "Notifications" and select "Only @mentions"*
			`
		)
		return
	} else if (msg.content.toLowerCase().startsWith("!social")) {
		let member = msg.member
		if (member.roles.cache.has(social_role.id)) {
			msg.react('💩')
		} else {
			await member.roles.add(social_role).catch(console.error)
			msg.react('🎉')
		}
		return
	}

	// Prevent commands below this from being run outside of mentoring hours
	let now = new Date();
	if (now.getHours() < 9 || now.getHours() > 17 || now.getDay() === 0 || now.getDay() === 6) {
		if (msg.content.toLowerCase().startsWith("!") && !mentor) {
			msg.channel.send(`
				Sorry ${msg.author}, but we currently only offer online mentoring from ${mentoring_times}.
				If you have just a quick question feel free to post it in
				<#691857971675791370> and someone might be able to help!`)
			return
		}
	}

	/////////////////////////////////////
	//          Commands
	/////////////////////////////////////

	// Non-specific commands
	 if (msg.content.toLowerCase().startsWith("!ping")) {
		if (online_mentor_afk_list.length < online_role.members.keyArray().length) {
			msg.channel.send(`${msg.author} is requesting mentoring assistance ${online_role}`)
		} else {
			msg.channel.send(`${msg.author}, the online mentor(s) are currently away from their computer. Please be patient, they will be right back.`);

			let estimated_return_time = "";
			online_mentor_afk_list.map((afk_mentor) => {
				estimated_return_time = afk_mentor.estimated_return_time < estimated_return_time || estimated_return_time === "" ? afk_mentor.estimated_return_time : estimated_return_time
				afk_mentor.name.send(`When you get back, ${msg.author} is looking for help.`)
			})

			if (estimated_return_time !== "") {
				msg.channel.send(`Estimated Return Time ---> ${estimated_return_time}`)
			}
		}
	} else if (msg.content.toLowerCase().startsWith("!join")) {
		msg.guild.channels.create(`${msg.author.username}'s Office`, {
			type: `category`,
			permissionOverwrites: [
				{
					id: msg.guild.id,
					deny: [`CONNECT`, `SPEAK`, `VIEW_CHANNEL`]
				},
				{
					id: msg.author.id,
					allow: [`CONNECT`, `SPEAK`, `VIEW_CHANNEL`]
				},
				{
					id: mentor_role.id,
					allow: [`CONNECT`, `SPEAK`, `VIEW_CHANNEL`]
				},
			]
		}).then( personalCategory => {
			createdChannels.push(personalCategory)
			msg.guild.channels.create(`${msg.author.username}-voice`, {
				type: `voice`,
				permissionOverwrites: [
					{
						id: msg.guild.id,
						deny: [`CONNECT`, `SPEAK`, `VIEW_CHANNEL`]
					},
					{
						id: msg.author.id,
						allow: [`CONNECT`, `SPEAK`, `VIEW_CHANNEL`]
					},
					{
						id: mentor_role.id,
						allow: [`CONNECT`, `SPEAK`, `VIEW_CHANNEL`]
					},
				],
				topic: `Voice channel for mentoring ${msg.author.username}`,
				parent: personalCategory
			}).catch(error => {
				msg.channel.send(`${msg.author}, I was unable to create a voice channel: ${error}`)
				console.error()
			});

			msg.guild.channels.create(`${msg.author.username}-text`, {
				type: `text`,
				permissionOverwrites: [
					{
						id: msg.guild.id,
						deny: [`VIEW_CHANNEL`, `SEND_MESSAGES`, `READ_MESSAGE_HISTORY`, `ATTACH_FILES`]
					},
					{
						id: msg.author.id,
						allow: [`VIEW_CHANNEL`, `SEND_MESSAGES`, `READ_MESSAGE_HISTORY`, `ATTACH_FILES`]
					},
					{
						id: mentor_role.id,
						allow: [`VIEW_CHANNEL`, `SEND_MESSAGES`, `READ_MESSAGE_HISTORY`, `ATTACH_FILES`]
					},
				],
				topic: `Text channel for mentoring ${msg.author.username}`,
				parent: personalCategory
			}).then(() => {
				msg.channel.send(`Voice and text channels have been created, ${msg.author}. Please step into your new office for mentoring`)
			}).catch(error => {
		msg.channel.send(`${msg.author}, I was unable to create a text channel: ${error}`)
		console.error()
		})
	})
	}

	// Mentor specific commands
	if (mentor) {
		switch (msg.content.split(' ')[0]) {

			case "!close":
				msg.channel.send(`${msg.author}, shutting down all voice channels`)
				createdChannels.forEach((channel) => {
					channel.children.forEach((childChannel) => {
						childChannel.delete("closing time *Insert song here*")
					})
					channel.delete("closing time *Insert song here*")
				})
				createdChannels = []
				break;

			case "!sos":
				msg.channel.send(`${msg.author} is in need of assistance. Would any ${mentor_role} like to volunteer as tribute to assist this hard working individual? Please, you are our only hope`, {files: ["./SOS.png"]})
				break;

			case "!online":
				if (!online) {
					msg.member.roles.add(online_role)
					msg.channel.send(`${msg.author} is now mentoring`)
				} else {
					msg.channel.send(`${msg.author} is already online`)
				}
				break;

			case "!offline":
				if (online) {
					msg.member.roles.remove(online_role)
					msg.channel.send(`${msg.author} is no longer mentoring`)
				} else {
					msg.channel.send(`${msg.author} isn't currently mentoring to begin with`)
				}
				break;

			case "!brb":
				if (online) {
					let estimated_return_time = ""
					cmds = msg.content.split(" ")
					if (cmds.length != 1) {
						now.setMinutes(now.getMinutes() + parseInt(cmds[1]))
						estimated_return_time = now.getHours() + ":" + now.getMinutes()
					}

					online_mentor_afk_list.push({name: msg.author, estimated_return_time: estimated_return_time})
					msg.channel.send(`${msg.author} will be right back. Keep up the good work and don't miss them too much :)`)
				}
				break;

			case "!trash30":
				if (online) {
					msg.channel.send("Heeeeeeeeeey Lab! It's Trash:30. Throw out any trash around you, even if it's not yours.")
				} else {
					msg.channel.send(`${msg.author} isn't the mentor on duty. Don't fall for their shenanigans.`)
				}
				break;

			case "!morning":
				msg.channel.send("Good morning everybody! Hope you are ready for another busy day of mentoring :smile:",
					{files: ["https://www.poynter.org/wp-content/uploads/2019/07/shutterstock_264132746.jpg"]}
				);
				break;

			case "!nightnight":
				msg.channel.send("The SSE Mentors are getting a good night rest so they can help you out bright and early tomorrow morning.",
					{files: ["https://media.tenor.com/images/950960797e3b597b8fedc869eabad846/tenor.gif"]}
				);
				break;
		}
	}
})

client.login(process.env.BOT_TOKEN);


//////////////////////////////////////
////// Discord Markdown Helpers //////
//////////////////////////////////////

// From: 'example text'
// To: '`example text`'
let inline = (strings) => {
	return "`" + strings + "`";
}

// From: 'example text
//        example text
//        example text'
// To:   '>example text
//        >example text
//        >example text'
let quote = (strings) => {
	let response = '';
	strings.split('\n').forEach( (string) => {
		response += `> ${string}\n`;
	});
	return response;
}
