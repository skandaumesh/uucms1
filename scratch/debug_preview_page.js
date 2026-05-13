const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const CryptoJS = require('crypto-js');
const cheerio = require('cheerio');

const UUCMS_BASE_URL = 'https://uucms.karnataka.gov.in';

const encryptPassword = (password) => {
  const key = CryptoJS.enc.Utf8.parse('8080808080808080');
  const iv = CryptoJS.enc.Utf8.parse('8080808080808080');
  return CryptoJS.AES.encrypt(password, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString();
};

async function runTest(username, password) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true }));

  // Login
  const loginPageRes = await client.get(`${UUCMS_BASE_URL}/Login/Index`);
  const $login = cheerio.load(loginPageRes.data);
  const csrfToken = $login('input[name="__RequestVerificationToken"]').val();
  const digits = Array.from({ length: 5 }, () => Math.ceil(Math.random() * 9));
  const generatedCaptcha = digits.join(' ');

  const formData = new URLSearchParams();
  formData.append('model[HiddenUserName]', encryptPassword(username));
  formData.append('model[HiddenPassword]', encryptPassword(encodeURIComponent(password)));
  formData.append('model[organization]', 'Student');
  formData.append('model[loginType]', 'Regular');
  formData.append('model[HiddenGeneratedCaptcha]', encryptPassword(generatedCaptcha));
  formData.append('model[HiddenInputCaptcha]', encryptPassword(digits.join('')));
  formData.append('__RequestVerificationToken', csrfToken);

  await client.post(`${UUCMS_BASE_URL}/Login/Index`, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }
  });
  
  const enc = 'UhOGy2GMtyZ81fT8hw6Ig7AITFZs7XQ7HZASd+yEp10irQhKVdJ+CfrvMJgVzDgS';
  const previewUrl = `${UUCMS_BASE_URL}/MIS/PreviewStudentApplicationDetails?enc=${enc}`;
  
  console.log(`Fetching Preview Page: ${previewUrl}`);
  const res = await client.get(previewUrl);
  const html = res.data;
  const $ = cheerio.load(html);
  
  console.log("Page Title:", $('title').text());
  
  // Find Photo
  console.log("\nSearching for Photo:");
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    const id = $(el).attr('id');
    const className = $(el).attr('class');
    if (src && src.includes('Photo')) {
       console.log(`- Found Potential Photo: ID=${id}, Class=${className}, Src=${src}`);
    }
  });

  // Find Labels/Values
  console.log("\nSearching for Labels/Values:");
  const labelsToFind = ['Father', 'Mother', 'DOB', 'Birth', 'Category', 'Blood'];
  $('td, th, label, b, strong, span').each((_, el) => {
    const text = $(el).text().trim();
    if (labelsToFind.some(l => text.includes(l))) {
       const next = $(el).next().text().trim() || $(el).closest('td, th').next('td, th').text().trim();
       console.log(`- Match: "${text}" -> "${next}"`);
    }
  });
  
  // Save snippet to scratch
  const fs = require('fs');
  fs.writeFileSync('scratch/preview_debug.html', html.substring(0, 10000));
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
