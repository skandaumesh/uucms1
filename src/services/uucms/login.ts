import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import CryptoJS from 'crypto-js';
import * as cheerio from 'cheerio';
import { SessionManager, UUCMS_Session } from './sessionManager';
import { extractCSRFToken, extractAllFormFields } from './csrf';
import upstash from '@/lib/upstash';

const UUCMS_BASE_URL = 'https://uucms.karnataka.gov.in';

// Setup axios with cookie support
const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));

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
  const res = await client.get(loginUrl);
  
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
  
  // Use a dedicated client for this session to handle cookie updates automatically
  const sessionClient = wrapper(axios.create({ jar: currentJar, withCredentials: true }));
  
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
