const axios = require('axios');
axios.get('https://uucms.karnataka.gov.in/Login/Index').then(res => {
  const html = res.data;
  const matches = html.match(/var\s+\w+\s*=\s*['"]([^'"]*)['"]/g);
  console.log('Variables:', matches);
  
  const captchaIdMatch = html.match(/id="Generatedcaptcha"[^>]*value="([^"]*)"/);
  console.log('Generatedcaptcha Value:', captchaIdMatch);
});
