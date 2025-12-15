"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Ticket Detail Page - Redirect to Main Support Page
 * 
 * This page now redirects to the unified support messenger.
 * The ticket ID is passed as a query parameter for auto-selection.
 */
export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const ticketId = params.id as string;

    useEffect(() => {
        // Redirect to main tickets page
        // The unified messenger will handle showing the ticket
        router.replace(`/profile/tickets?selected=${ticketId}`);
    }, [ticketId, router]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <svg className="w-7 h-7 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <p className="text-gray-400 text-sm">در حال انتقال...</p>
            </div>
        </div>
    );
}
