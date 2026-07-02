export type UserRole = "admin" | "tecnico";
export type TicketStatus = "received" | "in_progress" | "resolved";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  location_id: string;
  description: string;
  photo_path: string | null;
  customer_contact: string | null;
  status: TicketStatus;
  assigned_to: string | null;
  created_at: string;
}
