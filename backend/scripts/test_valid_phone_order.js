import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const cashfreeBaseUrl = "https://sandbox.cashfree.com/pg";

function getCashfreeHeaders() {
  return {
    "x-client-id": CASHFREE_APP_ID,
    "x-client-secret": CASHFREE_SECRET_KEY,
    "x-api-version": "2023-08-01",
    "Content-Type": "application/json",
  };
}

async function run() {
  const orderId = `test_ord_valid_phone_${Date.now()}`;
  try {
    const response = await axios.post(
      `${cashfreeBaseUrl}/orders`,
      {
        order_id: orderId,
        order_amount: 10.00,
        order_currency: "INR",
        customer_details: {
          customer_id: "test_customer_id",
          customer_name: "Test Customer",
          customer_email: "test@example.com",
          customer_phone: "9999999999", // valid phone prefix
        },
        order_meta: {
          return_url: "http://localhost:8080/callback"
        }
      },
      {
        headers: getCashfreeHeaders()
      }
    );

    console.log("SUCCESS creating test order with valid phone!");
    console.log("Session ID:", response.data.payment_session_id);
  } catch (error) {
    console.error("FAILED creating test order:", error?.response?.data || error.message);
  }
}

run();
