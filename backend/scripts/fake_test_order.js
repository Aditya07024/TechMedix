import axios from 'axios';

const CASHFREE_APP_ID = "TEST111093983914e675df2de7bc38e189390111";
const CASHFREE_SECRET_KEY = "cfsk_ma_test_invalidkey12345678901234567890123456789";

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
  const orderId = `test_ord_fake_${Date.now()}`;
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
          customer_phone: "9999999999",
        },
        order_meta: {
          return_url: "http://localhost:8080/callback"
        }
      },
      {
        headers: getCashfreeHeaders()
      }
    );

    console.log("SUCCESS creating fake test order!");
    console.log(response.data);
  } catch (error) {
    console.log("FAILED creating fake test order (Expected):", error?.response?.data || error.message);
  }
}

run();
