import crypto from "crypto";

export interface SseTicketStore {
  set(ticket: string, userId: string, ttlSeconds: number): Promise<void>;
  consume(ticket: string): Promise<string | null>;
}

type TicketEntry = {
  userId: string;
  timer: NodeJS.Timeout;
};

class InMemorySseTicketStore implements SseTicketStore {
  private store = new Map<string, TicketEntry>();

  async set(ticket: string, userId: string, ttlSeconds: number) {
    this.clear(ticket);

    const timer = setTimeout(() => {
      this.store.delete(ticket);
    }, ttlSeconds * 1000);

    this.store.set(ticket, { userId, timer });
  }

  async consume(ticket: string) {
    const entry = this.store.get(ticket);
    if (!entry) {
      return null;
    }

    clearTimeout(entry.timer);
    this.store.delete(ticket);

    return entry.userId;
  }

  private clear(ticket: string) {
    const existing = this.store.get(ticket);
    if (!existing) {
      return;
    }

    clearTimeout(existing.timer);
    this.store.delete(ticket);
  }
}

const TICKET_TTL_SECONDS = 10;
const ticketStore = new InMemorySseTicketStore();

export const generateSseTicket = async (userId: string) => {
  const ticket = crypto.randomBytes(16).toString("hex");
  await ticketStore.set(ticket, userId, TICKET_TTL_SECONDS);
  return ticket;
};

export const consumeSseTicket = async (ticket: string) => {
  return ticketStore.consume(ticket);
};
