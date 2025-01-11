const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  AttachmentBuilder,
  MessageActionRow,
  MessageButton,
  ActionRowBuilder,
  SlashCommandBuilder,
  ButtonBuilder, 
  ButtonStyle,
} = require("discord.js");
const fs = require("fs").promises; 
const { createCanvas, loadImage } = require("canvas");
const axios = require('axios');
let userData = {};
const dataFile = './database.json';

async function loadData() {
    try {
        const rawData = await fs.readFile(dataFile, 'utf-8');
        userData = JSON.parse(rawData);
    } catch (error) {
        console.log('Tidak ada data yang ditemukan, memulai dengan data kosong');
    }
}

async function saveData() {
    const dataToSave = JSON.stringify(userData, null, 2);
    try {
        await fs.writeFile(dataFile, dataToSave);
        // console.log('Data disimpan');
    } catch (error) {
        console.error('Gagal menyimpan data:', error);
    }
}

const TOKEN = config.TOKEN;
const CLIENT_ID = config.CLIENT_ID; 

const imageBaseUrl = "https://jkt48-member.vercel.app";
let members = [];
let filteredMembers = [];

async function loadMembersData() {
  try {
    const data = await fs.readFile("./membersData.json", "utf-8");
    members = JSON.parse(data); 
    filteredMembers = members;
  } catch (error) {
    console.error("Error reading members data:", error);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", async () => {
  console.log(`${client.user.tag} is ready!`);
  await loadMembersData();
  loadData();
  setInterval(async () => { await saveData(); }, 5 * 60 * 1000);
  monitorStreams();
  await registerCommands();
});

async function getTop10Benar() {
  try {
    const data = await fs.readFile('database.json', 'utf8');
    const jsonData = JSON.parse(data);
    const sortedData = Object.entries(jsonData)
      .sort(([, a], [, b]) => b.benar - a.benar)
      .slice(0, 10);
    
    let resultMessage = "10 Benar Terbanyak:\n";
    sortedData.forEach(([id, { benar }], index) => {
      resultMessage += `${index + 1}. <@${id}>, ${benar}x Benar.\n`;
    });

    return resultMessage;
  } catch (err) {
    console.error("Terjadi kesalahan:", err);
    return "Terjadi kesalahan saat mengambil data.";
  }
}

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  const { difficulty } = require('./data.json');
  if (message.mentions.has(client.user)) {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("JKT48 - Guessr!")
      .setDescription("This bot is a Fanmade, try using ```/guess```\n```/lb```")
      .setTimestamp()
      .setFooter({
        text: "Created by Frenzy.",
        iconURL: "https://i.postimg.cc/sD8FZ00J/IMG-20241001-WA0064.jpg",
    });
    message.reply({ embeds: [embed] });
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;
    
 if (interaction.commandName === "lb") {
    await interaction.deferReply(); // Menunda balasan
    const message = await getTop10Benar(); // Mendapatkan hasil secara asinkron
    await interaction.editReply(message); // Mengirim balasan setelah data siap
 }

  if (commandName === "guess") {
    const difficulty = interaction.options.getString('difficulty');
    if (!difficulty) {
        difficulty = "easy";
	}
    if (members.length === 0) {
      await interaction.reply(
        "Members data is not loaded yet. Please try again later."
      );
      return;
    }
	const userId = interaction.user.id;
    if (!userData[userId]) {
        userData[userId] = { strike: 0, longestStrike: 0, benar: 0, salah: 0 };
        saveData();
    }
    await interaction.deferReply();
    // const randomMember = members[Math.floor(Math.random() * members.length)];
    const nonGraduatedMembers = members.filter(member => !member.graduated);
    const GraduatedMembers = members.filter(member => member.graduated);
	let randomMember;
    if (difficulty == "easy") {
    	randomMember = nonGraduatedMembers[Math.floor(Math.random() * nonGraduatedMembers.length)];
	} else randomMember = GraduatedMembers[Math.floor(Math.random() * nonGraduatedMembers.length)];
    const canvas = createCanvas(500, 500);
    const ctx = canvas.getContext("2d");
    try {
      const image = await loadImage(
        `${imageBaseUrl}/assets/member/${randomMember.picture.split("/").pop()}`
      );
      // console.log(`${imageBaseUrl}/assets/member/${randomMember.picture.split("/").pop()}`);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height); 
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.beginPath();
      const circleX = canvas.width / 2; 
      const circleY = canvas.height / 2; 
      const circleRadius = 130; 
      ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Guess", circleX, circleY); 
    } catch (error) {
      console.error("Error loading image:", error);
    }
    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: "canvas-image.png",
    });
    const nameParts = randomMember.name.toLowerCase().split(" ");
    const initials = nameParts.map((part) => part[0].toUpperCase()).join(" ");
    const graduate = randomMember.graduated ? "Ya" : "Tidak";
    const trainee = randomMember.trainee ? "Ya" : "Tidak";
    await interaction.editReply({
      content: `**Siapa kah dia?**\n- Insial: **${initials}**\n- Trainee: **${trainee}**\n- Generasi: **${randomMember.generation}**\n- Graduate: **${graduate}**\n- Difficulty: **${difficulty.toUpperCase()}**`,
      files: [attachment],
    });
    const filter = (response) => response.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 60000,
    });
    collector.on("collect", (message) => {
      const guess = message.content.trim().toLowerCase();
      const isCorrect = nameParts.some((part) => guess.includes(part));

    if (isCorrect) {
    userData[userId].benar++;
    // userData[userId].salah++;
    saveData();
    const stats = {
        'Benar': userData[userId].benar,
        'Salah': userData[userId].salah
    };
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Benar!")
        .setDescription("Benar! Dia adalah **" + randomMember.name + "**, Stats kamu:\n```js\n{ 'Benar': " + userData[userId].benar + ", 'Salah': " + userData[userId].salah + " }```")
        .setTimestamp()
        .setFooter({
            text: "Created by Frenzy.",
            iconURL: "https://i.postimg.cc/sD8FZ00J/IMG-20241001-WA0064.jpg",
        });
    	interaction.followUp({ embeds: [embed] });
} else {
    userData[userId].salah++;
    saveData();
    const stats = {
        'Benar': userData[userId].benar,
        'Salah': userData[userId].salah
    };
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Salah!")
        .setDescription("Salah! Dia adalah **" + randomMember.name + "**, Stats kamu:\n```js\n{ 'Benar': " + userData[userId].benar + ", 'Salah': " + userData[userId].salah + " }```")
        .setTimestamp()
        .setFooter({
            text: "Created by Frenzy.",
            iconURL: "https://i.postimg.cc/sD8FZ00J/IMG-20241001-WA0064.jpg",
        });
    interaction.followUp({ embeds: [embed] });
	}
    collector.stop();
    });
    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        interaction.followUp("Game ini diberhentikan, jawaban terlalu lama.");
      }
    });
  }
});

const commands = [
    new SlashCommandBuilder()
        .setName('guess')
        .setDescription('Untuk memulai permainan tebak member JKT48.')
        .addStringOption(option =>
            option
                .setName('difficulty')
                .setDescription('Pilih tingkat ke sulitan')
                .setRequired(true)
                .addChoices(
                    { name: 'MUDAH - Graduated: No', value: 'easy' },
                    { name: 'SUSAH - Graduated: Ya', value: 'hard' }
                )
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName('lb')
        .setDescription('Mendapatkan user dengan tebakan benar terbanyak.')
        .toJSON(),
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log("Refreshing application commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: commands,
    });
    console.log("Successfully reloaded application commands.");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
}

client.login(TOKEN);