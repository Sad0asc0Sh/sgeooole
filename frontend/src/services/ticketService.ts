import api from "@/lib/api";

/**
 * Ticket Message Interface
 * Represents a single message within a ticket conversation
 */
export interface TicketMessage {
    _id: string;
    sender: string; // 'user' or 'admin'
    message: string;
    createdAt: string;
}

/**
 * Ticket Interface
 * Represents a support ticket with all its details
 */
export interface Ticket {
    _id: string;
    ticketId: string; // Human readable ID like T-1001
    subject: string;
    department: string;
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'pending' | 'closed' | 'answered';
    messages: TicketMessage[];
    createdAt: string;
    updatedAt: string;
}

/**
 * Create Ticket Payload
 */
export interface CreateTicketPayload {
    subject: string;
    department: string;
    priority: string;
    message: string;
}

/**
 * Ticket Service
 *
 * Handles support ticket management for authenticated users.
 *
 * Backend Endpoints:
 * - GET /api/tickets/my-tickets - Get user's tickets
 * - GET /api/tickets/:id - Get ticket by ID
 * - POST /api/tickets - Create new ticket
 * - POST /api/tickets/:id/reply - Reply to a ticket
 *
 * Status: ✅ Connected to Real Backend API
 */
export const ticketService = {
    /**
     * Get All User's Tickets
     * Retrieves all tickets for the authenticated user
     *
     * @returns Promise with list of tickets
     */
    getAll: async (): Promise<Ticket[]> => {
        try {
            console.log("[TICKET] Fetching user tickets");
            const { data } = await api.get('/tickets/my-tickets');
            return data.data || data;
        } catch (error: any) {
            console.error("Error fetching tickets:", error);
            throw new Error(
                error.response?.data?.message || "خطا در دریافت لیست تیکت‌ها"
            );
        }
    },

    /**
     * Get Ticket by ID
     * Retrieves a specific ticket by its ID (user's own tickets only)
     *
     * @param id - Ticket ID
     * @returns Promise with ticket details
     */
    getById: async (id: string): Promise<Ticket> => {
        try {
            console.log(`[TICKET] Fetching ticket ${id}`);
            const { data } = await api.get(`/tickets/my-tickets/${id}`);
            return data.data || data;
        } catch (error: any) {
            console.error("Error fetching ticket:", error);
            throw new Error(
                error.response?.data?.message || "خطا در دریافت اطلاعات تیکت"
            );
        }
    },

    /**
     * Create New Ticket
     * Creates a new support ticket
     *
     * @param payload - Ticket details including subject, department, priority, message
     * @returns Promise with created ticket
     */
    create: async (payload: CreateTicketPayload): Promise<Ticket> => {
        try {
            console.log("[TICKET] Creating ticket:", payload);
            const { data } = await api.post('/tickets', payload);
            return data.data || data;
        } catch (error: any) {
            console.error("Error creating ticket:", error);
            throw new Error(
                error.response?.data?.message || "خطا در ثبت تیکت"
            );
        }
    },

    /**
     * Reply to Ticket
     * Adds a reply message to an existing ticket (user's own tickets only)
     *
     * @param id - Ticket ID
     * @param message - Reply message content
     * @returns Promise with updated ticket
     */
    reply: async (id: string, message: string): Promise<Ticket> => {
        try {
            console.log(`[TICKET] Replying to ticket ${id}`);
            const { data } = await api.post(`/tickets/my-tickets/${id}/reply`, { message });
            return data.data || data;
        } catch (error: any) {
            console.error("Error replying to ticket:", error);
            throw new Error(
                error.response?.data?.message || "خطا در ارسال پاسخ"
            );
        }
    }
};
