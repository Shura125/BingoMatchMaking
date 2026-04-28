import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";

export function buildTypeButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_type_casual")
      .setLabel("Casual Matchmaking")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("mm_type_competitive")
      .setLabel("Competitive Matchmaking")
      .setStyle(ButtonStyle.Danger)
  );
}

export function buildModeSelect() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("mm_modes")
      .setPlaceholder("Choose one or more game modes")
      .setMinValues(1)
      .setMaxValues(3)
      .addOptions(
        {
          label: "Veilbreak",
          value: "veilbreak",
          description: "Search for a Veilbreak match.",
        },
        {
          label: "Base Game",
          value: "base_game",
          description: "Search for a Base Game match.",
        },
        {
          label: "Scadubingo",
          value: "scadubingo",
          description: "Search for a Scadubingo match.",
        }
      )
  );
}

export function buildDurationSelect() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("mm_duration")
      .setPlaceholder("How long are you searching?")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        {
          label: "30 minutes",
          value: "30",
        },
        {
          label: "1 hour",
          value: "60",
        },
        {
          label: "2 hours",
          value: "120",
        },
        {
          label: "Until cancelled",
          value: "0",
        }
      )
  );
}

export function buildCreateTicketButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_create_ticket")
      .setLabel("Create Matchmaking Ticket")
      .setStyle(ButtonStyle.Success)
  );
}