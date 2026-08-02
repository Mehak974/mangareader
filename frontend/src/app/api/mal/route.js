import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = searchParams.get('limit') || '12';
  const ranking_type = searchParams.get('ranking_type');
  
  const malClientId = process.env.MAL_CLIENT_ID;
  if (!malClientId) {
    return NextResponse.json({ error: 'MAL_CLIENT_ID not configured' }, { status: 500 });
  }

  let malUrl = '';
  if (q) {
    malUrl = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(q)}&limit=${limit}&fields=id,title,main_picture,mean,num_chapters,status,genres`;
  } else if (ranking_type) {
    malUrl = `https://api.myanimelist.net/v2/manga/ranking?ranking_type=${ranking_type}&limit=${limit}&fields=id,title,main_picture,mean,num_chapters,status,genres`;
  } else {
    return NextResponse.json({ error: 'Missing query parameters' }, { status: 400 });
  }

  try {
    const malRes = await fetch(malUrl, {
      headers: { 'X-MAL-CLIENT-ID': malClientId },
      next: { revalidate: 300 }
    });
    
    if (!malRes.ok) {
      return NextResponse.json({ error: `MAL API error: ${malRes.status}` }, { status: malRes.status });
    }
    
    const data = await malRes.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
