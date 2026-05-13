const axios = require('axios');
axios.get('https://uucms.karnataka.gov.in/Login/Index').then(res => {
  const html = res.data;
  console.log('HTML Length:', html.length);
  const captchaMatch = html.match(/id="Generatedcaptcha"[^>]*value="([^"]*)"/);
  console.log('Captcha Value Match:', captchaMatch ? `"${captchaMatch[1]}"` : 'Not found');
  
  const hiddenGeneratedMatch = html.match(/id="HiddenGeneratedCaptcha"[^>]*value="([^"]*)"/);
  console.log('Hidden Generated Captcha Match:', hiddenGeneratedMatch ? `"${hiddenGeneratedMatch[1]}"` : 'Not found');
  const scriptSources = html.match(/src="([^"]+\.js)"/g);
  console.log('Script Sources:', scriptSources);
});
