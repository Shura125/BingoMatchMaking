import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { GameModeSelectGroup, getGameModesForSelect } from "../gameModes";

export function buildTypeButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_type_bingo")
      .setLabel("Bingo Mode")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("mm_type_casual_games")
      .setLabel("Casual Game Modes")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("mm_type_competitive")
      .setLabel("Official Matchmaking")
      .setStyle(ButtonStyle.Danger)
  );
}

export function buildCompetitiveHostRoleButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_comp_host_player")
      .setLabel("I am playing")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("mm_comp_host_organizer")
      .setLabel("I am only hosting")
      .setStyle(ButtonStyle.Secondary)
  );
}

export function buildModeSelect(
  modeGroup: GameModeSelectGroup = "bingo"
) {
  const options = getGameModesForSelect(modeGroup).map((mode) => ({
    label: mode.label,
    value: mode.id,
    description: mode.description,
  }));

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("mm_modes")
      .setPlaceholder("Choose one or more game modes")
      .setMinValues(1)
      .setMaxValues(options.length)
      .addOptions(...options)
  );
}

export function buildMatchDetailsButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_add_match_details")
      .setLabel("Add Match Details")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("mm_skip_match_details")
      .setLabel("Skip Details")
      .setStyle(ButtonStyle.Secondary)
  );
}

export function buildMatchDetailsModal() {
  return new ModalBuilder()
    .setCustomId("mm_match_details_modal")
    .setTitle("Match Details")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("match_title")
          .setLabel("Match title")
          .setPlaceholder("Example: Late Night Veilbreak Lobby")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("match_details")
          .setLabel("Details")
          .setPlaceholder("Example: Looking for chill players, mic preferred.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500)
      )
    );
}

export function buildCasualTimingButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_casual_search_now")
      .setLabel("Search Now")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("mm_casual_schedule")
      .setLabel("Schedule Casual Match")
      .setStyle(ButtonStyle.Primary)
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

export function buildScheduleTimestampButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("mm_open_schedule_timestamp_modal")
      .setLabel("Enter Discord Timestamp")
      .setStyle(ButtonStyle.Primary)
  );
}

export function buildScheduleTimestampModal() {
  return new ModalBuilder()
    .setCustomId("mm_schedule_timestamp_modal")
    .setTitle("Schedule Match")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("scheduled_timestamp")
          .setLabel("Discord timestamp")
          .setPlaceholder("Example: <t:1777941000:F>")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
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
