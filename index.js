const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const http = require('http');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const FOOTBALL_API_KEY = "87466794418c6364a319afd9c37515df";
const VIP_ROLE_ID = "1546527537771839548";

let cachedGlobalFixtures = {};
let cachedRawFixtures = [];

const commands = [
  new SlashCommandBuilder()
    .setName('menu')
    .setDescription('Open your private Brendini Bets Control Center'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}! Brendini Bets is live ⚡`);
  try {
    const guildId = client.guilds.cache.first()?.id;
    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body: commands },
      );
      console.log('Successfully reloaded guild (/) commands.');
    }
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'menu') {
      const hasVip = interaction.member.roles.cache.has(VIP_ROLE_ID);

      const embed = new EmbedBuilder()
        .setColor(hasVip ? 0x00FF7F : 0xFF4500)
        .setTitle('🔥 BRENDINI BETS — PRIVATE CONTROL CENTER')
        .setDescription(
          hasVip 
            ? '👑 **VIP Status Active:** Welcome to your unthrottled AI dashboard. Access all leagues and daily accas below.'
            : 'Welcome! You are currently on the **Free Teaser Tier** (limited lower-tier & teaser matches). Upgrade to VIP for full unthrottled access.'
        )
        .setFooter({ text: `Generated for ${interaction.user.tag} (${interaction.user.id}) — Strictly Confidential` });

      const row = new ActionRowBuilder();

      if (hasVip) {
        row.addComponents(
          new ButtonBuilder().setCustomId('btn_vip_dashboard').setLabel('👑 Open VIP Dashboard').setStyle(ButtonStyle.Success)
        );
      } else {
        row.addComponents(
          new ButtonBuilder().setCustomId('btn_free_dashboard').setLabel('⚡ Free Teaser Dashboard').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel('💳 Get VIP Access (£15/mo)').setStyle(ButtonStyle.Link).setURL('https://buy.stripe.com/fZueVc5SS57L27E4fC2wU06')
        );
      }

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  }

  // Security Check: Only the original user can click their buttons/menus
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    const messageAuthorId = interaction.message.interaction?.user?.id;
    if (messageAuthorId && interaction.user.id !== messageAuthorId) {
      return interaction.reply({ content: '❌ This is not your control panel! Type `/menu` to open your own.', ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const hasVip = interaction.member.roles.cache.has(VIP_ROLE_ID);

    // Smart Back Button Routing
    if (interaction.customId === 'btn_back_dashboard') {
      if (!hasVip) {
        const embed = new EmbedBuilder()
          .setColor(0xFF4500)
          .setTitle('🔥 BRENDINI BETS — PRIVATE CONTROL CENTER')
          .setDescription('Welcome! You are currently on the **Free Teaser Tier** (limited lower-tier & teaser matches). Upgrade to VIP for full unthrottled access.')
          .setFooter({ text: `Generated for ${interaction.user.tag} (${interaction.user.id}) — Strictly Confidential` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_free_dashboard').setLabel('⚡ Free Teaser Dashboard').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setLabel('💳 Get VIP Access (£15/mo)').setStyle(ButtonStyle.Link).setURL('https://buy.stripe.com/fZueVc5SS57L27E4fC2wU06')
        );

        await interaction.update({ embeds: [embed], components: [row] });
        return;
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x00FF7F)
          .setTitle('👑 BRENDINI BETS — VIP GLOBAL ANALYZER')
          .setDescription('Full unthrottled website mirror. Select a dashboard filter below:')
          .setFooter({ text: `Generated for ${interaction.user.tag} (${interaction.user.id}) — Strictly Confidential` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_popular').setLabel('⭐ Popular Leagues').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_accas').setLabel('🔥 Daily Accas').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('btn_all_leagues').setLabel('📊 All Leagues').setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
        return;
      }
    }

    // Direct VIP Dashboard Handler
    if (interaction.customId === 'btn_vip_dashboard') {
      const embed = new EmbedBuilder()
        .setColor(0x00FF7F)
        .setTitle('👑 BRENDINI BETS — VIP GLOBAL ANALYZER')
        .setDescription('Full unthrottled website mirror. Select a dashboard filter below:')
        .setFooter({ text: `Generated for ${interaction.user.tag} (${interaction.user.id}) — Strictly Confidential` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_popular').setLabel('⭐ Popular Leagues').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_accas').setLabel('🔥 Daily Accas').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_all_leagues').setLabel('📊 All Leagues').setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ embeds: [embed], components: [row] });
    }

    // Free Teaser Dashboard Handler
    if (interaction.customId === 'btn_free_dashboard') {
      await interaction.update({ content: '⚽ **Loading limited free fixtures...** Please wait.', embeds: [], components: [] });

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${todayStr}`, {
          headers: { "x-apisports-key": FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" }
        });
        const result = await response.json();

        if (!result.response || result.response.length === 0) {
          return interaction.editReply({ content: '❌ No fixtures found.' });
        }

        let leaguesMap = {};
        let includedCount = 0;

        result.response.forEach(item => {
          const leagueName = item.league.name;
          const country = item.league.country;
          const displayKey = `${country}: ${leagueName}`;

          const isTeaserPopular = leagueName.toLowerCase().includes('eredivisie') || leagueName.toLowerCase().includes('championship');
          const isLowerTier = country.toLowerCase() === 'romania' || country.toLowerCase() === 'bulgaria' || country.toLowerCase() === 'greece';

          if ((isTeaserPopular || isLowerTier) && !leaguesMap[displayKey]) {
            if (includedCount < 4) {
              leaguesMap[displayKey] = [];
              includedCount++;
            }
          }

          if (leaguesMap[displayKey]) {
            leaguesMap[displayKey].push({
              id: item.fixture.id,
              name: `${item.teams.home.name} vs ${item.teams.away.name}`
            });
          }
        });

        cachedGlobalFixtures[interaction.user.id] = leaguesMap;
        const leagueKeys = Object.keys(leaguesMap);

        if (leagueKeys.length === 0) {
          return interaction.editReply({ content: '❌ No limited leagues available right now.' });
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_league')
          .setPlaceholder('🏆 Select a free teaser league...')
          .addOptions(leagueKeys.map(l => ({ label: l.substring(0, 100), value: l })));

        const embed = new EmbedBuilder()
          .setColor(0x38BDF8)
          .setTitle('⚡ Free Teaser Leagues (Limited Access)')
          .setDescription('Select a teaser league below. Unlock all leagues & AI accas via VIP (£15/mo):')
          .setFooter({ text: `Generated for ${interaction.user.tag} (${interaction.user.id}) — Strictly Confidential` });

        await interaction.editReply({ content: '', embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });

      } catch (err) {
        console.error(err);
        interaction.editReply({ content: '❌ Failed to load free fixtures.' });
      }
    }

    // VIP Sub-filters: Popular Leagues or All Leagues
    if (interaction.customId === 'btn_popular' || interaction.customId === 'btn_all_leagues') {
      await interaction.update({ content: '⚽ **Fetching live fixtures from API-Football...** Please wait.', embeds: [], components: [] });

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${todayStr}`, {
          headers: { "x-apisports-key": FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" }
        });
        const result = await response.json();

        if (!result.response || result.response.length === 0) {
          return interaction.editReply({ content: '❌ No active fixtures found for today.' });
        }

        cachedRawFixtures = result.response;
        const popularLeaguesList = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "UEFA Champions League", "Eredivisie", "Championship"];
        let leaguesMap = {};

        result.response.forEach(item => {
          const country = item.league.country || "International";
          const leagueName = item.league.name || "General";
          const displayKey = `${country}: ${leagueName}`;
          const isPopular = popularLeaguesList.some(pop => leagueName.toLowerCase().includes(pop.toLowerCase()));

          if (interaction.customId === 'btn_popular' && !isPopular) return;

          if (!leaguesMap[displayKey]) leaguesMap[displayKey] = [];
          leaguesMap[displayKey].push({
            id: item.fixture.id,
            name: `${item.teams.home.name} vs ${item.teams.away.name}`
          });
        });

        cachedGlobalFixtures[interaction.user.id] = leaguesMap;
        const leagueKeys = Object.keys(leaguesMap).slice(0, 25);

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_league')
          .setPlaceholder('🏆 Select a league...')
          .addOptions(leagueKeys.map(l => ({ label: l.substring(0, 100), value: l })));

        const embed = new EmbedBuilder()
          .setColor(0x38BDF8)
          .setTitle(interaction.customId === 'btn_popular' ? '⭐ Popular Leagues' : '📊 All Available Leagues')
          .setDescription('Select a league below to view available fixtures:')
          .setFooter({ text: `Generated for ${interaction.user.tag} (${interaction.user.id}) — Strictly Confidential` });

        await interaction.editReply({ content: '', embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });

      } catch (err) {
        console.error(err);
        interaction.editReply({ content: '❌ Failed to fetch leagues.' });
      }
    } 
    else if (interaction.customId === 'btn_accas') {
      await interaction.update({ content: '🔥 **AI is filtering finished games and building daily accas...** Please wait.', embeds: [], components: [] });

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${todayStr}`, {
          headers: { "x-apisports-key": FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" }
        });
        const result = await response.json();

        if (!result.response || result.response.length === 0) {
          return interaction.editReply({ content: '❌ No active fixtures found for today.' });
        }

        let upcomingFixturesSummary = "";
        result.response.forEach(item => {
          const country = item.league.country || "International";
          const leagueName = item.league.name || "General";
          const matchName = `${item.teams.home.name} vs ${item.teams.away.name}`;
          const matchTime = new Date(item.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
          upcomingFixturesSummary += `\n- [${country}] ${leagueName} (${matchTime}): ${matchName} (ID: ${item.fixture.id})`;
        });

        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://brendini-bets.web.app",
            "X-Title": "Brendini Bets",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages: [
              {
                role: "system",
                content: `You are Brendini's elite professional sports quant and betting sharpshooter. 
                
                STRICTLY UPCOMING UNSTARTED FIXTURES TODAY:
                ${upcomingFixturesSummary}
                
                CRITICAL RULES FOR ACCUMULATORS:
                1. UPCOMING GAMES ONLY: Use ONLY unstarted matches listed above.
                2. ADVANCED MULTI-LEG BUILDER PICKS: Include sharp multi-leg combo bets matching website standards.
                3. SORTED BY PROBABILITY (HIGHEST FIRST): Sort the array of 5 accas strictly from HIGHEST win probability percentage down to LOWEST.
                4. METRICS REQUIREMENT: Every card title MUST include its calculated Win Probability (%) and Bookmaker Odds Value (e.g., "🎯 Safe Banker Acca (82% Win | @ 1.85)").
                5. JSON ONLY: Return ONLY a valid JSON array containing exactly 5 distinct objects matching this exact structure:
                [
                  {
                    "title": "🎯 Safe Banker Acca (82% Win | @ 1.85)",
                    "odds": "1.85",
                    "legs": [
                      { "match": "Exact match name from list", "pick": "Specific data-backed pick" }
                    ]
                  }
                ]`
              },
              {
                role: "user",
                content: `Generate accas using strictly unstarted upcoming fixtures, sorted from highest win probability to lowest.`
              }
            ]
          })
        });

        const data = await aiResponse.json();
        let rawText = data.choices[0].message.content.trim();
        
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const firstBracket = rawText.indexOf('[');
        const lastBracket = rawText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            rawText = rawText.substring(firstBracket, lastBracket + 1);
        }

        const accasArray = JSON.parse(rawText);

        const embedsArray = accasArray.map((acc, index) => {
          let legsFormatted = acc.legs.map(l => `• ${l.pick}\n   *(${l.match})*`).join('\n\n');
          return new EmbedBuilder()
            .setColor(index === 0 ? 0x10B981 : 0xF59E0B)
            .setTitle(`${index + 1}. ${acc.title}`)
            .addFields({ name: `Combined Odds: @ ${acc.odds}`, value: legsFormatted, inline: false })
            .setFooter({ text: `Generated exclusively for ${interaction.user.tag} (${interaction.user.id}) — Leaking leads to an instant permanent ban.` });
        });

        const backRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_back_dashboard').setLabel('🔙 Back to Dashboard').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ content: '🔥 **VIP DAILY ACCUMULATORS (AI SHARPSHOOTER)**', embeds: embedsArray, components: [backRow] });

      } catch (e) {
        console.error("AI Daily Acca generation error:", e);
        await interaction.editReply({ content: '❌ Failed to compile upcoming accumulators. Try clicking the button again.' });
      }
    }
  }

  // Handle League Selection -> Show Match Dropdown
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_league') {
    const selectedLeague = interaction.values[0];
    const userLeagues = cachedGlobalFixtures[interaction.user.id] || {};
    const matches = userLeagues[selectedLeague] || [];

    const matchOptions = matches.slice(0, 25).map(m => ({
      label: m.name.substring(0, 100),
      value: `${m.id}|${m.name}`
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_match_ai')
      .setPlaceholder(`⚽ Select a match in ${selectedLeague}...`)
      .addOptions(matchOptions);

    const embed = new EmbedBuilder()
      .setColor(0xF59E0B)
      .setTitle(`🏆 ${selectedLeague}`)
      .setDescription('Select any match below to run the AI profit engine:')
      .setFooter({ text: `Generated for ${interaction.user.tag} (${interaction.user.id}) — Strictly Confidential` });

    await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
  }

  // Handle Match Selection -> Generate Exactly 6 Website-Identical AI Slips
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_match_ai') {
    const [fixtureId, matchQuery] = interaction.values[0].split('|');
    
    await interaction.update({ 
      content: `🤖 **Pulling Pro API Stats & Querying OpenRouter AI...** Building 6 elite betting slips for **${matchQuery}** matching your website standards. Please hold...`, 
      embeds: [],
      components: [] 
    });

    try {
      const apiHeaders = { "x-apisports-key": FOOTBALL_API_KEY, "x-rapidapi-host": "v3.football.api-sports.io" };
      let compiledProContext = { fixture: null, statistics: null, players: null, lineups: null, h2h: null };
      
      if (fixtureId && fixtureId !== "undefined") {
          const fixRes = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, { headers: apiHeaders });
          const fixData = await fixRes.json();

          if (fixData.response && fixData.response.length > 0) {
              compiledProContext.fixture = fixData.response[0];
              const homeId = compiledProContext.fixture.teams.home.id;
              const awayId = compiledProContext.fixture.teams.away.id;

              const [statsRes, playersRes, lineupsRes, h2hRes] = await Promise.all([
                  fetch(`https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`, { headers: apiHeaders }),
                  fetch(`https://v3.football.api-sports.io/fixtures/players?fixture=${fixtureId}`, { headers: apiHeaders }),
                  fetch(`https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`, { headers: apiHeaders }),
                  fetch(`https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}`, { headers: apiHeaders })
              ]);

              const statsData = await statsRes.json();
              const playersData = await playersRes.json();
              const lineupsData = await lineupsRes.json();
              const h2hData = await h2hRes.json();

              if (statsData.response) compiledProContext.statistics = statsData.response;
              if (playersData.response) compiledProContext.players = playersData.response;
              if (lineupsData.response) compiledProContext.lineups = lineupsData.response;
              if (h2hData.response) compiledProContext.h2h = h2hData.response.slice(0, 5);
          }
      }

      const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://brendini-bets.web.app",
          "X-Title": "Brendini Bets",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: `You are Brendini's elite professional sports quant and betting sharpshooter, matching the exact logic used on the Brendini Bets website. 
              
              API-FOOTBALL PRO DATA PAYLOAD:
              ${JSON.stringify(compiledProContext)}
              
              STRICT RULES (IDENTICAL TO WEBSITE):
              1. USE ONLY VERIFIED CURRENT PLAYERS: Check lineups and player payloads.
              2. EXACTLY 6 SLIPS: Generate exactly 6 distinct, high-value betting slips matching your website categories:
                 - Slip 1: ⭐ Pro Match Favs (Win % | Odds)
                 - Slip 2: 🎯 Deep-Scouted Single (Win % | Odds)
                 - Slip 3: 🎯 Verified Pro Player Prop (Win % | Odds)
                 - Slip 4: 🟨 Match Cards & Fouls Builder (Win % | Odds)
                 - Slip 5: 🔥 Ultimate 90-Min Value Builder (Win % | Odds)
                 - Slip 6: 💎 Ultimate Multi-Leg Safe Bet Builder (High value multi-leg accumulator slip)
              3. METRICS REQUIREMENT: Every card title MUST include its calculated Win Probability (%) and Bookmaker Odds Value.
              4. JSON ONLY: Return ONLY a valid JSON array of exactly 6 objects matching this structure, with no markdown wrapping:
              [
                {
                  "title": "⭐ Pro Match Favs (64% Win | @ 2.05)",
                  "odds": "2.05",
                  "legs": [
                    { "match": "${matchQuery}", "pick": "Specific data-backed pick" }
                  ]
                }
              ]`
            },
            { role: "user", content: `Generate exactly 6 professional betting slips for ${matchQuery} matching website standards.` }
          ]
        })
      });

      const aiData = await aiResponse.json();
      let rawText = aiData.choices[0].message.content.trim();
      
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstBracket = rawText.indexOf('[');
      const lastBracket = rawText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        rawText = rawText.substring(firstBracket, lastBracket + 1);
      }

      const slips = JSON.parse(rawText);

      const embedsArray = slips.map((slip, idx) => {
        let legsFormatted = slip.legs.map(l => `• ${l.pick}\n   *(${l.match})*`).join('\n\n');
        return new EmbedBuilder()
          .setColor(idx === 5 ? 0x38BDF8 : 0xF59E0B)
          .setTitle(`${idx + 1}. ${slip.title}`)
          .addFields({ name: `Combined Odds: @ ${slip.odds}`, value: legsFormatted, inline: false })
          .setFooter({ text: `Generated exclusively for ${interaction.user.tag} (${interaction.user.id}) — Leaking leads to an instant permanent ban.` });
      });

      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_back_dashboard').setLabel('🔙 Back to Dashboard').setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ content: `🔥 **AI PROFIT ENGINE — ${matchQuery.toUpperCase()}**`, embeds: embedsArray, components: [backRow] });

    } catch (err) {
      console.error("AI Generation Error details:", err);
      await interaction.editReply({ content: '❌ Failed to generate website AI slips. Check your console logs for details.' });
    }
  }
});

// Stripe Webhook Listener
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/stripe-webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const discordUserId = session.metadata?.discord_id;
          if (discordUserId) {
            const guild = client.guilds.cache.first();
            guild.members.fetch(discordUserId).then(member => {
              const role = guild.roles.cache.get(VIP_ROLE_ID);
              if (member && role) member.roles.add(role);
            }).catch(console.error);
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      } catch (err) {
        res.writeHead(400);
        res.end(`Webhook Error: ${err.message}`);
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3000, () => {
  console.log('Stripe webhook listener active on port 3000 🌐');
});

client.login(process.env.DISCORD_TOKEN);