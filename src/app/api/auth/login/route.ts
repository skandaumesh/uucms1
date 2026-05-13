import { NextResponse } from 'next/server';
import { completeLogin } from '@/services/uucms/login';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function POST(request: Request) {
  try {
    const { username, password, captcha, tempSessionId } = await request.json();

    if (!username || !password || !captcha || !tempSessionId) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // 1. Authenticate with UUCMS using captcha
    // Note: The session is already saved to Redis inside completeLogin
    await completeLogin(tempSessionId, username, password, captcha);

    // 2. Generate Local JWT using uucmsId as the primary identifier
    const token = jwt.sign(
      { uucmsId: username, role: 'student' },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    const response = NextResponse.json({
      success: true,
      user: {
        uucmsId: username,
        name: username, // Temporary placeholder
      }
    });

    // Set HTTP-only cookie
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
    });

    return response;

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Authentication failed' }, { status: 401 });
  }
}
