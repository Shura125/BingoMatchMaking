import { Client } from "discord.js";
import {
  expireTicket,
  getExpiredOpenTickets,
} from "../services/ticketService";
import { refreshTicketMessage } from "../utils/ticketMessage";

const ONE_MINUTE = 60_000;

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

    console.log(`Expired ticket ${ticket.id}`);
  }
}