require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ButtonBuilder, ButtonStyle, ActionRowBuilder, Events, MessageFlags } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const activeTimers = new Map();

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.content === '!starttimer') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('timer_30').setLabel('30 Minutes').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('timer_60').setLabel('1 Hour').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('timer_90').setLabel('1.5 Hours').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('timer_custom').setLabel('🔧 Custom Time').setStyle(ButtonStyle.Secondary)
        );

        await message.reply({ content: '🕒 Choose a timer duration:', components: [row] });
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const userId = interaction.user.id;

    if (activeTimers.has(userId)) {
        return interaction.reply({ content: "⚠️ You already have a timer running.", flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'timer_30') {
        await startTimer(interaction, 30);
    } else if (interaction.customId === 'timer_60') {
        await startTimer(interaction, 60);
    } else if (interaction.customId === 'timer_90') {
        await startTimer(interaction, 90);
    } else if (interaction.customId === 'timer_custom') {
        await interaction.reply({ content: "✏️ Enter the duration in minutes (e.g., `45`, `120`):", flags: MessageFlags.Ephemeral });

        const filter = m => m.author.id === userId;
        const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 30000 });

        collector.on('collect', async (msg) => {
            const minutes = parseInt(msg.content);
            if (isNaN(minutes) || minutes <= 0) {
                return msg.reply("❌ Please enter a valid number greater than 0.");
            }

            await startTimer(interaction, minutes, true);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followUp({ content: "⌛ Timed out. No duration provided.", flags: MessageFlags.Ephemeral });
            }
        });
    } else if (interaction.customId === 'pause_timer') {
        const timer = activeTimers.get(userId);
        if (!timer || timer.paused) {
            return interaction.reply({ content: "⚠️ Timer is already paused or not found.", flags: MessageFlags.Ephemeral });
        }
        clearInterval(timer.interval);
        timer.paused = true;
        await interaction.reply({ content: "⏸️ Timer paused.", flags: MessageFlags.Ephemeral });

    } else if (interaction.customId === 'resume_timer') {
        const timer = activeTimers.get(userId);
        if (!timer || !timer.paused) {
            return interaction.reply({ content: "⚠️ Timer is not paused or not found.", flags: MessageFlags.Ephemeral });
        }
        timer.interval = setInterval(() => tick(userId), 1000);
        timer.paused = false;
        await interaction.reply({ content: "▶️ Timer resumed.", flags: MessageFlags.Ephemeral });

    } else if (interaction.customId === 'stop_timer') {
        const timer = activeTimers.get(userId);
        if (!timer) {
            return interaction.reply({ content: "⚠️ No timer found to stop.", flags: MessageFlags.Ephemeral });
        }
        clearInterval(timer.interval);
        await timer.message.edit({ content: "⏹️ Timer stopped.", components: [] });
        activeTimers.delete(userId);
        await interaction.reply({ content: "✅ Timer has been stopped.", flags: MessageFlags.Ephemeral });
    }
});

async function startTimer(interaction, minutes, isFollowUp = false) {
    const userId = interaction.user.id;
    let duration = minutes * 60;

    const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pause_timer').setLabel('⏸️ Pause').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('resume_timer').setLabel('▶️ Resume').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('stop_timer').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger),
    );

    let message;
    const content = `⏳ Timer started for ${minutes} minutes.\nTime left: ${formatTime(duration)}`;

    if (isFollowUp) {
        message = await interaction.followUp({ content, components: [controlRow] });
    } else {
        message = await interaction.reply({ content, components: [controlRow] });
        message = await interaction.fetchReply(); // to get message object for editing
    }

    const interval = setInterval(() => tick(userId), 1000);

    activeTimers.set(userId, {
        duration,
        interval,
        paused: false,
        message,
        notifyEvery: 30 * 60, // 30 minutes
        originalInteraction: interaction
    });
}

function tick(userId) {
    const timer = activeTimers.get(userId);
    if (!timer || timer.paused) return;

    timer.duration--;

    const formatted = formatTime(timer.duration);
    timer.message.edit({ content: `⏳ Timer running...\nTime left: ${formatted}` });

    if (timer.duration % timer.notifyEvery === 0 && timer.duration > 0) {
        timer.message.channel.send(`<@${userId}> ⏰ ${timer.duration / 60} minutes left.`);
    }

    if (timer.duration <= 0) {
        clearInterval(timer.interval);
        timer.message.edit({ content: "✅ Time's up!", components: [] });
        activeTimers.delete(userId);
    }
}

function formatTime(seconds) {
    let hrs = Math.floor(seconds / 3600);
    let mins = Math.floor((seconds % 3600) / 60);
    let secs = seconds % 60;

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

client.login(process.env.DISCORD_TOKEN);

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(3000, () => console.log('🌐 Web server running'));
