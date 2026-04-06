import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export interface PixPaymentResponse {
  id: number;
  status: string;
  qrCode?: string;
  qrCodeBase64?: string;
  amount: number;
}

export async function createPixPayment(amount: number, description: string, email: string): Promise<PixPaymentResponse | null> {
  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.mercadopagoToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID()
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description,
        payment_method_id: 'pix',
        installments: 1,
        payer: {
          email
        },
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Erro ao criar pagamento MP Pix:', data);
      return null;
    }

    return {
      id: data.id,
      status: data.status,
      qrCode: data.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64,
      amount: data.transaction_amount
    };
  } catch (error: any) {
    console.error('Erro ao criar pagamento MP Pix:', error.message);
    return null;
  }
}

export async function getPaymentStatus(paymentId: string | number): Promise<string> {
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${env.mercadopagoToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Erro ao consultar status MP:', data);
      return 'error';
    }

    return data.status;
  } catch (error: any) {
    console.error('Erro ao consultar status MP:', error.message);
    return 'error';
  }
}
