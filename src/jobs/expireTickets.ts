import { Client } from "discord.js";
import {
  expireTicket,
  getExpiredOpenTickets,
  getExpiredTicketsReadyToDelete,
  getStartedTicketsPastLimit,
  closeTicket,
} from "../services/ticketService";
import { refreshTicketMessage } from "../utils/ticketMessage";
import { deleteTicketMessage } from "../utils/ticketCleanup";

const ONE_MINUTE = 60_000;
const AUTO_FINISH_HOURS = 2;

export function startExpireTicketsJob(client: Client) {
  console.log("Ticket cleanup job started");

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
  await expireOpenTickets(client);
  await autoFinishStartedTickets(client);
  await deleteExpiredTicketMessages(client);
}

async function expireOpenTickets(client: Client) {
  const expiredOpenTickets = await getExpiredOpenTickets();

  for (const ticket of expiredOpenTickets) {
    const success = await expireTicket(ticket.id);

    if (!success) {
      console.error(`Failed to expire ticket ${ticket.id}`);
      continue;
    }

    await refreshTicketMessage(client, ticket.id);
    console.log(`Expired ticket ${ticket.id}`);
  }
}

async function autoFinishStartedTickets(client: Client) {
  const startedTickets = await getStartedTicketsPastLimit(AUTO_FINISH_HOURS);

  console.log(
    `Auto-finish check found ${startedTickets.length} started tickets older than ${AUTO_FINISH_HOURS} hours`
  );

  for (const ticket of startedTickets) {
    const success = await closeTicket(ticket, "finished");

    if (!success) {
      console.error(`Failed to auto-finish ticket ${ticket.id}`);
      continue;
    }

    await refreshTicketMessage(client, ticket.id);

    console.log(
      `Auto-finished ticket ${ticket.id} after ${AUTO_FINISH_HOURS} hours`
    );
  }
}

async function deleteExpiredTicketMessages(client: Client) {
  const ticketsToDelete = await getExpiredTicketsReadyToDelete();

  for (const ticket of ticketsToDelete) {
    await deleteTicketMessage(client, ticket);
    console.log(`Deleted expired ticket message ${ticket.id}`);
  }
}