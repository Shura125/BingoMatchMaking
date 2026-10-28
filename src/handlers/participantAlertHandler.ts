import { ChannelType, type ButtonInteraction } from 'discord.js';
import { fetchTicket, getAcceptances } from '../services/ticketService';
import { claimParticipantAlert, postParticipantAlert } from '../services/participantAlertService';
import { getStartModeOptionsForTicket } from '../utils/playerLimits';
import { resolveTicketPlayerNames } from '../utils/playerNames';
import { refreshTicketMessage } from '../utils/ticketMessage';

export async function handleAlertParticipants(interaction: ButtonInteraction, ticketId: string): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const ticket = await fetchTicket(ticketId);
  if (!ticket || ticket.guild_id !== interaction.guildId || ticket.channel_id !== interaction.channelId) {
    await interaction.editReply({ content: 'This ticket is no longer available in this channel.' });
    return;
  }
  if (ticket.participants_alert_requested_at) {
    await interaction.editReply({ content: 'Alert Participants has already been used for this ticket.' });
    return;
  }
  const acceptances = await getAcceptances(ticketId);
  if (ticket.status !== 'open' || (ticket.expires_at && Date.parse(ticket.expires_at) <= Date.now())
    || !getStartModeOptionsForTicket(ticket, acceptances).canStart) {
    await interaction.editReply({ content: 'The roster must be ready to start before you can alert participants.' });
    return;
  }
  // Validate the channel and resolve names before consuming the one-time claim.
  const channel = await interaction.client.channels.fetch(ticket.channel_id);
  if (!channel || channel.type !== ChannelType.GuildText || !ticket.message_id) {
    await interaction.editReply({ content: 'The main ticket channel or message is unavailable.' });
    return;
  }
  const names = await resolveTicketPlayerNames(interaction.client, ticket, acceptances);
  let claimed = false;
  try {
    const alert = await claimParticipantAlert(ticketId);
    if (!alert) {
      await interaction.editReply({ content: 'The alert was already used, or the roster is no longer ready.' });
      return;
    }
    claimed = true;
    await postParticipantAlert(interaction.client, alert, names);
    await interaction.editReply({ content: 'Players alerted. The linked alert will delete after 10 minutes.' });
  } catch (error) {
    console.error('Participant alert failed:', error);
    await interaction.editReply({ content: claimed
      ? 'The alert could not be completed. This one-time action remains used to avoid duplicate pings; please contact an admin.'
      : 'Could not create the alert. Please try again.' });
  } finally {
    if (claimed) await refreshTicketMessage(interaction.client, ticketId).catch(error => console.error('Could not refresh Alert Participants button:', error));
  }
}
