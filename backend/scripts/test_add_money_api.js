import axios from 'axios';

async function run() {
  try {
    // 1. Log in
    const loginRes = await axios.post('http://localhost:8080/auth/login', {
      email: 'demo@techmedix.com',
      password: 'demo' // wait, password_hash has demo123 or demo? Let's try demo123 first.
    });

    console.log("Login successful!");
    const token = loginRes.data.token;
    
    // 2. Call add-money
    const res = await axios.post('http://localhost:8080/api/payments/wallet/add-money', {
      amount: 5000
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("API Response payload:");
    console.log(JSON.stringify(res.data, null, 2));

  } catch (error) {
    if (error.response?.status === 401) {
      console.log("Retrying login with password 'demo123'...");
      try {
        const loginRes = await axios.post('http://localhost:8080/auth/login', {
          email: 'demo@techmedix.com',
          password: 'demo123'
        });
        console.log("Login successful!");
        const token = loginRes.data.token;
        const res = await axios.post('http://localhost:8080/api/payments/wallet/add-money', {
          amount: 5000
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log("API Response payload:");
        console.log(JSON.stringify(res.data, null, 2));
        return;
      } catch (err2) {
        console.error("Retry failed:", err2.response?.data || err2.message);
      }
    }
    console.error("Test failed:", error.response?.data || error.message);
  }
}

run();
