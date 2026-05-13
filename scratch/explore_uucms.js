const axios = require('axios');
const cheerio = require('cheerio');

async function debug(cookies) {
  const urls = [
    'https://uucms.karnataka.gov.in/Login/OnLoginSucess',
    'https://uucms.karnataka.gov.in/StudentAttendance/Index',
    'https://uucms.karnataka.gov.in/ExamGeneral/ExamApplications'
  ];

  for (const url of urls) {
    console.log(`--- FETCHING ${url} ---`);
    try {
      const res = await axios.get(url, { headers: { 'Cookie': cookies } });
      const $ = cheerio.load(res.data);
      console.log(`Title: ${$('title').text().trim()}`);
      console.log(`Body Snippet: ${$('body').text().trim().substring(0, 200)}...`);
      // Find links
      $('a').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href');
        if (text.includes('Attendance') || text.includes('Profile') || text.includes('Result')) {
          console.log(`Link: [${text}] -> ${href}`);
        }
      });
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

// I'll need to pass the real cookies here from a valid session
// Since I don't have them easily, I'll just check the code first
