import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import upstash from '@/lib/upstash';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { SessionManager } from '@/services/uucms/sessionManager';
import { parseProfile, parseFullProfile } from '@/services/uucms/parser';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
const UUCMS = 'https://uucms.karnataka.gov.in';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const uucmsId = payload.uucmsId as string;

    const cacheKey = `uucms:cache:${uucmsId}:profile`;
    
    if (!forceRefresh) {
      const cached = await upstash.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        // If we have a photo, we are good. If not, maybe try to refresh.
        if (parsed.photoUrl) return NextResponse.json({ ...parsed, isCached: true });
      }
    }

    const session = await SessionManager.getSession(uucmsId);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    try {
      const cookieString = session.cookies.map(c => c.split(';')[0]).join('; ');
      const commonHeaders = {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': `${UUCMS}/Login/Success`,
      };

      const discoveryPaths = [
        '/Login/OnLoginSucess',
        '/StudentProfile/StudentProfile',
        '/ExamGeneral/ExamApplications',
        '/MIS/CandidateAdmissionTransactionHistory',
        '/Admission/StudentAdmissionStatusUpdatesView'
      ];

      let combinedHtml = '';
      let parsedData: any = {};

      for (const path of discoveryPaths) {
        try {
          const res = await axios.get(`${UUCMS}${path}`, { headers: commonHeaders, timeout: 6000 });
          if (res.data && !res.data.includes('NullReferenceException')) {
            combinedHtml += res.data;
            // Immediate partial parse
            if (path.includes('OnLoginSucess') || path.includes('StudentProfile')) {
              const partial = parseProfile(res.data, path.includes('StudentProfile') ? res.data : '', '');
              parsedData = { ...parsedData, ...partial };
            }
          }
        } catch (e) {}
      }

      // Deep Regex discovery for Preview links across all possible pages
      const match = combinedHtml.match(/\/MIS\/PreviewStudentApplicationDetails\?enc=[A-Za-z0-9+/=]+/);
      
      if (match) {
        try {
          const previewUrl = match[0].startsWith('http') ? match[0] : `${UUCMS}${match[0]}`;
          console.log(`[Profile API] Auto-discovered Preview Link: ${previewUrl}`);
          const fullProfileRes = await axios.get(previewUrl, { 
            headers: {
              ...commonHeaders,
              'Referer': `${UUCMS}/MIS/CandidateAdmissionTransactionHistory`
            }, 
            timeout: 8000 
          });
          if (!fullProfileRes.data.includes('Runtime Error') && !fullProfileRes.data.includes('NullReferenceException')) {
            const fullProfileData = parseFullProfile(fullProfileRes.data);
            parsedData = { ...parsedData, ...fullProfileData };
          }
        } catch (e) {}
      }

      // Proxy the photo URL if it exists to handle authentication
      if (parsedData.photoUrl) {
        parsedData.photoUrl = `/api/student/photo?url=${encodeURIComponent(parsedData.photoUrl)}`;
      }

      const result = { 
        ...parsedData, 
        username: uucmsId, // This is the student's login ID
        isCached: false 
      };
      await upstash.set(cacheKey, JSON.stringify(result), { ex: 86400 });

      return NextResponse.json(result);
    } catch (uucmsError: any) {
      const cached = await upstash.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return NextResponse.json({ ...parsed, isCached: true });
      }
      return NextResponse.json({ error: 'UUCMS failed' }, { status: 500 });
    }

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { previewLink } = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const uucmsId = payload.uucmsId as string;

    const session = await SessionManager.getSession(uucmsId);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    const cookieString = session.cookies.map(c => c.split(';')[0]).join('; ');
    const commonHeaders = {
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': `${UUCMS}/Login/Success`,
    };

    const fullUrl = previewLink.startsWith('http') ? previewLink : `${UUCMS}${previewLink}`;
    console.log(`[Manual Sync] Processing Link: ${fullUrl}`);
    
    let fullProfileData: any = {};

    // Check if it's a direct photo link
    if (fullUrl.includes('DownloadFile') || fullUrl.includes('ShowProfilePhoto')) {
       console.log("[Manual Sync] Detected Direct Photo Link");
       fullProfileData.photoUrl = fullUrl;
    } else {
       console.log("[Manual Sync] Fetching Full Identity Page...");
       const fullProfileRes = await axios.get(fullUrl, { headers: commonHeaders, timeout: 8000 });
       
       if (fullProfileRes.data.includes('Runtime Error') || fullProfileRes.data.includes('NullReferenceException') || fullProfileRes.data.includes('Server Error')) {
          console.log("[Manual Sync] Received Server Error page from UUCMS");
          return NextResponse.json({ error: 'UUCMS Portal returned a server error. Please try a different link or ensure you are logged in.' }, { status: 400 });
       }
       fullProfileData = parseFullProfile(fullProfileRes.data);
    }
    
    if (!fullProfileData.photoUrl && !fullProfileData.fatherName) {
       console.log("[Manual Sync] Parsed data is empty");
       return NextResponse.json({ error: 'Could not extract info from this link. Please ensure you are on the correct page.' }, { status: 400 });
    }

    // Download and Save photo as base64 to avoid proxy issues
    if (fullProfileData.photoUrl) {
       try {
          const photoFullUrl = fullProfileData.photoUrl.startsWith('http') ? fullProfileData.photoUrl : `${UUCMS}${fullProfileData.photoUrl.startsWith('/') ? '' : '/'}${fullProfileData.photoUrl}`;
          const photoRes = await axios.get(photoFullUrl, { 
             headers: commonHeaders, 
             responseType: 'arraybuffer',
             timeout: 8000 
          });
          const base64 = Buffer.from(photoRes.data).toString('base64');
          const mime = photoRes.headers['content-type'] || 'image/jpeg';
          fullProfileData.photoUrl = `data:${mime};base64,${base64}`;
       } catch (e: any) {
          console.error(`[Manual Sync] Photo download failed: ${e.message}`);
          // Fallback to proxy if download fails
          fullProfileData.photoUrl = `/api/student/photo?url=${encodeURIComponent(fullProfileData.photoUrl.startsWith('http') ? fullProfileData.photoUrl : `${UUCMS}${fullProfileData.photoUrl.startsWith('/') ? '' : '/'}${fullProfileData.photoUrl}`)}`;
       }
    }

    const cacheKey = `uucms:cache:${uucmsId}:profile`;
    const cached = await upstash.get(cacheKey);
    const existing = cached ? (typeof cached === 'string' ? JSON.parse(cached) : cached) : {};

    const result = { ...existing, ...fullProfileData, isCached: false };
    await upstash.set(cacheKey, JSON.stringify(result), { ex: 86400 * 30 }); // 30 days cache for identity

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[Manual Sync] Error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
