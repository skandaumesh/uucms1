const axios = require('axios');

const baseUrl = 'https://uucms.karnataka.gov.in';
const scripts = [
  '/Scripts/common.js',
  '/Scripts/ajaxCall.js',
  '/Scripts/XSS-validation-0.0.1.js',
  '/Scripts/jquery-3.7.0.min.js',
  '/Scripts/jquery.validate.min.js',
  '/Scripts/jquery.validate.unobtrusive.min.js'
];

async function find() {
  for (const s of scripts) {
    try {
      const res = await axios.get(baseUrl + s);
      if (res.data.includes('DrawCaptcha')) {
        console.log(`Found DrawCaptcha in ${s}`);
        // Log a bit of context
        const idx = res.data.indexOf('function DrawCaptcha');
        if (idx !== -1) {
          console.log(res.data.substring(idx, idx + 1000));
        } else {
          console.log('Called but not defined as "function DrawCaptcha"');
        }
      }
    } catch (e) {}
  }
}

find();
