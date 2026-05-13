import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import CryptoJS from 'crypto-js';
import * as cheerio from 'cheerio';
import { SessionManager, UUCMS_Session } from './sessionManager';
import { extractCSRFToken, extractAllFormFields } from './csrf';
import upstash from '@/lib/upstash';

const UUCMS_BASE_URL = 'https://uucms.karnataka.gov.in';

// Setup axios with cookie support and secure rotating proxy tunnel
const proxyConfig = {
  protocol: 'http',
  host: '27.34.242.98',
  port: 80
};

const jar = new CookieJar();
const client = wrapper(axios.create({ 
  jar, 
  withCredentials: true,
  proxy: proxyConfig 
}));

const encryptPassword = (password: string) => {
  const key = CryptoJS.enc.Utf8.parse('8080808080808080');
  const iv = CryptoJS.enc.Utf8.parse('8080808080808080');
  const encrypted = CryptoJS.AES.encrypt(password, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString();
};

export const initiateLogin = async () => {
  const loginUrl = `${UUCMS_BASE_URL}/Login/Index`;
  const res = await client.get(loginUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1'
    },
    timeout: 10000
  });
  
  const $ = cheerio.load(res.data);
  const csrfToken = extractCSRFToken(res.data);
  const hiddenFields = extractAllFormFields(res.data);
  
  // Generate captcha exactly like CaptchaLib.js does
  const generateCaptcha = () => {
    const digits = Array.from({ length: 5 }, () => Math.ceil(Math.random() * 9));
    return digits.join(' ');
  };

  const generatedCaptcha = generateCaptcha();

  const tempSessionId = Math.random().toString(36).substring(7);
  
  // Store the jar/cookies in Redis for the next step
  await upstash.set(`uucms:temp_jar:${tempSessionId}`, JSON.stringify(jar.toJSON()), { ex: 300 });
  await upstash.set(`uucms:temp_data:${tempSessionId}`, JSON.stringify({ csrfToken, hiddenFields, generatedCaptcha }), { ex: 300 });

  return {
    tempSessionId,
    captchaImage: null,
    csrfToken,
    hint: generatedCaptcha
  };
};

export const completeLogin = async (tempSessionId: string, username: string, password: string, captcha: string) => {
  const jarData = await upstash.get(`uucms:temp_jar:${tempSessionId}`);
  const metaData: any = await upstash.get(`uucms:temp_data:${tempSessionId}`);
  
  if (!jarData || !metaData) throw new Error('Session expired');
  
  const currentJar = CookieJar.fromJSON(typeof jarData === 'string' ? JSON.parse(jarData) : jarData);
  const { csrfToken, generatedCaptcha } = typeof metaData === 'string' ? JSON.parse(metaData) : metaData;
  
  // Use a dedicated client for this session to handle cookie updates automatically via secure proxy
  const sessionClient = wrapper(axios.create({ 
    jar: currentJar, 
    withCredentials: true,
    proxy: proxyConfig
  }));
  
  const loginUrl = `${UUCMS_BASE_URL}/Login/Index`;
  
  const formData = new URLSearchParams();
  formData.append('model[HiddenUserName]', encryptPassword(username));
  formData.append('model[HiddenPassword]', encryptPassword(encodeURIComponent(password)));
  formData.append('model[organization]', 'Student');
  formData.append('model[loginType]', 'Regular');
  formData.append('model[HiddenGeneratedCaptcha]', encryptPassword(generatedCaptcha));
  formData.append('model[HiddenInputCaptcha]', encryptPassword(captcha.replace(/\s/g, '')));
  formData.append('__RequestVerificationToken', csrfToken);
 
  const loginRes = await sessionClient.post(loginUrl, formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': loginUrl,
    }
  });

  if (loginRes.data.redirectTo?.includes('OnLoginSucess')) {
    const successUrl = `${UUCMS_BASE_URL}/Login/OnLoginSucess`;
    // The sessionClient (wrapped axios) will automatically handle the cookies set by the server
    await sessionClient.get(successUrl);

    // Save the fully populated cookie jar
    const session: UUCMS_Session = {
      aspNetSessionId: '', 
      requestVerificationToken: csrfToken,
      cookies: (await currentJar.getCookies(UUCMS_BASE_URL)).map(c => c.toString()),
    };

    await SessionManager.saveSession(username, session);
    return session;
  }

  throw new Error('Login failed: ' + (loginRes.data.message || 'Invalid credentials'));
};
