import { Client } from "discord.js";
import {
  expireTicket,
  getExpiredOpenTickets,
} from "../services/ticketService";
import { refreshTicketMessage } from "../utils/ticketMessage";
import { deleteTicketMessage } from "../utils/ticketCleanup";

const ONE_MINUTE = 60_000;
const DELETE_EXPIRED_AFTER_MS = 5 * 60 * 1000;

export function startExpireTicketsJob(client: Client) {
  setInterval(() => {
    expireTickets(client).catch((error) => {
      console.error("Expire tickets job failed:", error);
    });
  }, ONE_MINUTE);

  expireTickets(client).catch((error) => {
    console.error("Initial expire tickets job failed:", error);
  });
}

async function expireTickets(client: Client) {
  const expiredTickets = await getExpiredOpenTickets();

  for (const ticket of expiredTickets) {
    const success = await expireTicket(ticket.id);

    if (!success) {
      continue;
    }

    await refreshTicketMessage(client, ticket.id);

    setTimeout(async () => {
      await deleteTicketMessage(client, ticket);
    }, DELETE_EXPIRED_AFTER_MS);

    console.log(`Expired ticket ${ticket.id}`);
  }
}