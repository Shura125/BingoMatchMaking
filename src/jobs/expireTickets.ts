import { Client } from "discord.js";
import {
  closeTicket,
  expireTicket,
  getExpiredOpenTickets,
  getStartedTicketsPastLimit,
} from "../services/ticketService";
import { refreshTicketMessage } from "../utils/ticketMessage";

const ONE_MINUTE = 60_000;
const AUTO_FINISH_HOURS = 2;

export function startExpireTicketsJob(client: Client) {
  setInterval(() => {
    runTicketCleanupJob(client).catch((error) => {
      console.error("Ticket cleanup job failed:", error);
    });
  }, ONE_MINUTE);

  runTicketCleanupJob(client).catch((error) => {
    console.error("Initial ticket cleanup job failed:", error);
  });
}

async function runTicketCleanupJob(client: Client) {
  await expireOpenTickets(client);
  await autoFinishStartedTickets(client);
}

async function expireOpenTickets(client: Client) {
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

async function autoFinishStartedTickets(client: Client) {
  const startedTickets = await getStartedTicketsPastLimit(AUTO_FINISH_HOURS);

  for (const ticket of startedTickets) {
    const success = await closeTicket(ticket, "finished");

    if (!success) {
      continue;
    }

    await refreshTicketMessage(client, ticket.id);
    console.log(`Auto-finished ticket ${ticket.id} after ${AUTO_FINISH_HOURS} hours`);
  }
}