const axios = require('axios');

async function checkEndpoints() {
  const endpoints = [
    'http://localhost:3000/api/student/profile',
    'http://localhost:3000/api/student/attendance',
    'http://localhost:3000/api/student/results',
    'http://localhost:3000/api/student/ia-marks'
  ];

  for (const url of endpoints) {
    try {
      console.log(`Checking ${url}...`);
      const res = await axios.get(url);
      console.log(`- Status: ${res.status}`);
    } catch (e) {
      if (e.response) {
        console.log(`- Status: ${e.response.status} (${e.response.data?.error || 'Expected Error'})`);
      } else {
        console.log(`- Error: ${e.message}`);
      }
    }
  }
}

checkEndpoints();
