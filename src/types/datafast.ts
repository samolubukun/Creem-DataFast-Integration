export interface DataFastPaymentRequest {
  transaction_id: string;
  currency: string;
  amount: number;
  timestamp?: string;
  refunded?: boolean;
  renewal?: boolean;
  customer_id?: string;
  name?: string;
  email?: string;
  datafast_visitor_id?: string;
  datafast_session_id?: string;
}

export interface DataFastPaymentResponse {
  message: string;
  transaction_id: string;
}

export interface DataFastConfig {
  apiKey: string;
}
