import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import axios from 'axios';
import { SessionManager } from '@/services/uucms/sessionManager';
import * as fs from 'fs';
import * as path from 'path';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
const UUCMS = 'https://uucms.karnataka.gov.in';

export async function GET() {
  try {
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
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': `${UUCMS}/Login/Success`,
    };

    // Fetch all key pages
    const pages = [
      { name: 'success', url: `${UUCMS}/Login/OnLoginSucess` },
      { name: 'profile', url: `${UUCMS}/StudentProfile/StudentProfile` },
      { name: 'exam_apps', url: `${UUCMS}/ExamGeneral/ExamApplications` },
      { name: 'revaluations', url: `${UUCMS}/ExamReEvaluation/StudentRevaluations` },
    ];

    const results: any = {};
    const scratchDir = path.join(process.cwd(), 'scratch');
    
    for (const page of pages) {
      try {
        const res = await axios.get(page.url, { headers: commonHeaders, maxRedirects: 5 });
        const finalUrl = res.request?.res?.responseUrl || res.config?.url;
        const hasSkanda = res.data.includes('SKANDA');
        const hasStudent = res.data.includes('Student');
        const title = res.data.match(/<title>(.*?)<\/title>/)?.[1] || 'unknown';
        
        // Save full HTML to file
        fs.writeFileSync(path.join(scratchDir, `uucms_${page.name}.html`), res.data);
        
        results[page.name] = {
          finalUrl,
          title,
          hasSkanda,
          hasStudent,
          htmlLength: res.data.length,
          savedTo: `scratch/uucms_${page.name}.html`,
        };
      } catch (e: any) {
        results[page.name] = { error: e.message };
      }
    }

    // Also log the cookies we're using
    results.cookies = session.cookies.map(c => c.split(';')[0]).map(c => {
      const [key] = c.split('=');
      return key.trim();
    });

    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
