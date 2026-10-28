import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, type Client } from 'discord.js';
import { supabase } from '../supabase';
import { formatPlayerMention, type PlayerNames } from '../utils/playerNames';

export const PARTICIPANT_ALERT_LIFETIME_MS = 10 * 60_000;
export type ParticipantAlert = {
  id: string; ticket_id: string; guild_id: string; channel_id: string; main_message_id: string;
  recipient_ids: string[]; status: 'sending' | 'sent' | 'failed' | 'deleted'; message_id: string | null;
  requested_at: string; sent_at: string | null; delete_after: string | null; deleted_at: string | null;
};

export async function claimParticipantAlert(ticketId: string): Promise<ParticipantAlert | null> {
  const { data, error } = await supabase.rpc('bot_claim_participant_alert', { p_ticket_id: ticketId });
  if (error) throw error;
  return data?.[0] ?? null;
}

async function updateAlert(id: string, values: Partial<ParticipantAlert>) {
  const { error } = await supabase.from('bot_participant_alerts').update(values).eq('id', id);
  if (error) throw error;
}

export async function postParticipantAlert(client: Client, alert: ParticipantAlert, names: PlayerNames): Promise<void> {
  let sent;
  try {
    const channel = await client.channels.fetch(alert.channel_id);
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error('Participant alert channel is unavailable');
    const url = `https://discord.com/channels/${alert.guild_id}/${alert.channel_id}/${alert.main_message_id}`;
    const users = [...new Set(alert.recipient_ids)];
    // The database claims this once. Never retry a send: a timeout may mean
    // Discord accepted it, and another attempt could notify players twice.
    sent = await channel.send({
      content: users.map(id => formatPlayerMention(id, names)).join(' '),
      embeds: [new EmbedBuilder().setTitle('Your match is ready').setURL(url).setColor(0x57f287)
        .setDescription('The roster is ready to begin. Open the main ticket to coordinate with the host.')
        .setFooter({ text: 'This alert deletes after 10 minutes.' }).setTimestamp()],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('Open Main Ticket').setStyle(ButtonStyle.Link).setURL(url)
      )],
      allowedMentions: { parse: [], users, roles: [], repliedUser: false },
      nonce: alert.id.replace(/-/g, '').slice(0, 24), enforceNonce: true,
    });
  } catch (error) {
    await updateAlert(alert.id, { status: 'failed' }).catch(updateError => console.error('Could not save failed alert:', updateError));
    throw error;
  }
  const sentAt = new Date(sent.createdTimestamp).toISOString();
  const deleteAfter = new Date(sent.createdTimestamp + PARTICIPANT_ALERT_LIFETIME_MS).toISOString();
  const posted: ParticipantAlert = { ...alert, status: 'sent', message_id: sent.id, sent_at: sentAt, delete_after: deleteAfter };
  // Fast in-process deletion, backed by the persistent maintenance sweep.
  const timer = setTimeout(() =>
    deleteParticipantAlert(client, posted).catch(error => console.error('Participant alert deletion failed:', error)),
  Math.max(0, Date.parse(deleteAfter) - Date.now()));
  timer.unref();
  try {
    await updateAlert(alert.id, { status: 'sent', message_id: sent.id, sent_at: sentAt, delete_after: deleteAfter });
  } catch (error) {
    // Do not leave an untracked alert if its durable cleanup record fails.
    await deleteParticipantAlert(client, posted).catch(deleteError => console.error('Untracked participant alert cleanup failed:', deleteError));
    throw error;
  }
}

export async function deleteParticipantAlert(client: Client, alert: ParticipantAlert): Promise<void> {
  if (!alert.message_id) return;
  try {
    const channel = await client.channels.fetch(alert.channel_id);
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error('Participant alert channel is unavailable');
    await channel.messages.delete(alert.message_id);
  } catch (error) {
    // Deleted manually, or its channel no longer exists: cleanup is complete.
    if (![10008, 10003].includes((error as { code?: number }).code ?? 0)) throw error;
  }
  await updateAlert(alert.id, { status: 'deleted', deleted_at: new Date().toISOString() });
}

export async function cleanupParticipantAlerts(client: Client): Promise<void> {
  const { data, error } = await supabase.from('bot_participant_alerts').select('*')
    .eq('status', 'sent').lte('delete_after', new Date().toISOString()).order('delete_after').limit(100);
  if (error) throw error;
  for (const alert of (data ?? []) as ParticipantAlert[]) {
    try { await deleteParticipantAlert(client, alert); }
    catch (deleteError) { console.error(`Could not delete participant alert ${alert.id}:`, deleteError); }
  }
}
