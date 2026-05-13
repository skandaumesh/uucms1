const axios = require('axios');

async function checkApi() {
  // This will only work if we have a valid session cookie, but let's try to see the structure
  try {
    const res = await axios.get('http://localhost:3000/api/student/results?refresh=true');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log("Error: Could not call API directly without session");
  }
}

checkApi();
