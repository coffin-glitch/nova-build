export interface Load {
  rr_number: string;
  tm_number?: string;
  status_code?: string;
  pickup_date?: string;
  pickup_window?: string;
  delivery_date?: string;
  delivery_window?: string;
  equipment?: string;
  total_miles?: number;
  revenue?: number;
  purchase?: number;
  net?: number;
  margin?: number;
  customer_name?: string;
  customer_ref?: string;
  driver_name?: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  vendor_name?: string;
  dispatcher_name?: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface TelegramBid {
  id: number;
  bid_number: string;
  distance_miles?: number;
  pickup_timestamp?: string;
  delivery_timestamp?: string;
  stops?: string[];
  tag?: string;
  received_at: string;
  expires_at?: string;
  published: boolean;
  raw_text?: string;
  source_channel?: string;
  forwarded_to?: string;
}

export interface LoadOffer {
  id: number;
  load_rr: string;
  clerk_user_id: string;
  price: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: number;
  load_rr: string;
  clerk_user_id: string;
  accepted_price: number;
  created_at: string;
}

export interface CarrierProfile {
  user_id: string;
  mc?: string;
  dot?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  user_id: string;
  role: 'admin' | 'carrier';
  created_at: string;
}
