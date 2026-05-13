import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import axios from 'axios';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const photoUrl = searchParams.get('url');

    if (!photoUrl) {
      return new NextResponse('Missing photo URL', { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sessionStr = payload.session as string;
    const session = JSON.parse(sessionStr);

    const cookieString = session.cookies.map((c: string) => c.split(';')[0]).join('; ');
    
    const res = await axios.get(photoUrl, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://uucms.karnataka.gov.in/'
      },
      responseType: 'arraybuffer',
      timeout: 15000
    });

    const contentType = (res.headers['content-type'] || 'image/jpeg') as string;
    
    return new NextResponse(res.data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error: any) {
    console.error('[Photo Proxy] Error:', error.message);
    return new NextResponse('Failed to proxy photo', { status: 500 });
  }
}
