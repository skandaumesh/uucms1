const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');

async function check() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true }));
  
  const res = await client.get('https://uucms.karnataka.gov.in/Login/Index');
  const $ = cheerio.load(res.data);
  
  const generatedCaptcha = $('#Generatedcaptcha').val() || $('#Generatedcaptcha').text();
  const hiddenCaptcha = $('#HiddenGeneratedCaptcha').val();
  
  console.log('--- CAPTCHA INFO ---');
  console.log('ID Generatedcaptcha value:', $('#Generatedcaptcha').val());
  console.log('ID Generatedcaptcha text:', $('#Generatedcaptcha').text());
  console.log('ID HiddenGeneratedCaptcha value:', $('#HiddenGeneratedCaptcha').val());
  console.log('--- END CAPTCHA INFO ---');

  // Let's also look for any scripts that might set these
  const scripts = $('script').map((i, el) => $(el).html()).get();
  const drawCaptchaScript = scripts.find(s => s && s.includes('function DrawCaptcha'));
  if (drawCaptchaScript) {
    console.log('Found DrawCaptcha definition in inline script!');
  } else {
    console.log('DrawCaptcha definition NOT found in inline scripts.');
  }
}

check();
