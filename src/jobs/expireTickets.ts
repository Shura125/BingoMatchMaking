import { Client } from "discord.js";
import { expireTicket, getExpiredOpenTickets, getExpiredTicketsReadyToDelete, clearTicketMessageId, getStartedTicketsPastLimit, closeTicket } from "../services/ticketService";
import { refreshTicketMessage } from "../utils/ticketMessage";
import { deleteTicketMessage } from "../utils/ticketCleanup";
import { cleanupParticipantAlerts } from "../services/participantAlertService";

let running = false;

export function startExpireTicketsJob(client: Client) {
  const run = () => runTicketMaintenance(client).catch(error => console.error("Ticket maintenance failed:", error));
  setInterval(run, 60_000);
  void run();
}

export async function runTicketMaintenance(client: Client): Promise<void> {
  if (running) return;
  running = true;
  try {
    await cleanupParticipantAlerts(client).catch(error => console.error("Participant alert cleanup failed:", error));
    for (const ticket of await getExpiredOpenTickets()) {
      try {
        if (await expireTicket(ticket.id)) await refreshTicketMessage(client, ticket.id);
      } catch (error) { console.error("Ticket expiration failed:", error); }
    }
    for (const ticket of await getStartedTicketsPastLimit(2)) {
      try {
        if (await closeTicket(ticket, "finished")) await refreshTicketMessage(client, ticket.id);
      } catch (error) { console.error("Ticket auto-finish failed:", error); }
    }
    for (const ticket of await getExpiredTicketsReadyToDelete()) {
      try {
        if (await deleteTicketMessage(client, ticket)) await clearTicketMessageId(ticket.id);
      } catch (error) { console.error("Expired message cleanup failed:", error); }
    }
  } finally {
    running = false;
  }
}
