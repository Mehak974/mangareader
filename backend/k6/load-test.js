import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const apiTrend = new Trend('api_response_time');
const pageTrend = new Trend('page_load_time');
const errors = new Counter('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{type:api}': ['p(95)<500'],
    'http_req_duration{type:page}': ['p(95)<1500'],
    'errors': ['count<100'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  group('Manga Discovery', () => {
    const res = http.get(`${BASE_URL}/api/manga/recent?limit=10`, {
      headers: { 'Accept': 'application/json' },
    });
    check(res, { 'Recent API OK': (r) => r.status === 200 });
    apiTrend.add(res.timings.duration);
    sleep(0.5);
  });

  group('Search Performance', () => {
    const queries = ['solo leveling', 'one piece', 'attack on titan'];
    const query = queries[Math.floor(Math.random() * queries.length)];
    const res = http.get(`${BASE_URL}/api/manga/search?q=${encodeURIComponent(query)}&limit=20`, {
      headers: { 'Accept': 'application/json' },
    });
    check(res, { 'Search API OK': (r) => r.status === 200 });
    apiTrend.add(res.timings.duration);
    sleep(1);
  });

  group('Homepage Load', () => {
    const res = http.get(BASE_URL);
    check(res, { 'Homepage OK': (r) => r.status === 200 });
    pageTrend.add(res.timings.duration);
    sleep(1);
  });

  group('Manga Detail Page', () => {
    const res = http.get(`${BASE_URL}/manga/solo-leveling`);
    check(res, { 'Detail Page OK': (r) => r.status === 200 });
    pageTrend.add(res.timings.duration);
    sleep(0.5);
  });

  group('Chapter Images', () => {
    const res = http.get(`${API_URL}/api/chapter/images?url=https://example.com/chapter1`, {
      headers: { 'Accept': 'application/json' },
    });
    check(res, { 'Chapter API OK': (r) => r.status === 200 || r.status === 404 });
    apiTrend.add(res.timings.duration);
    sleep(0.5);
  });

  group('Admin Stats (Protected)', () => {
    const res = http.get(`${API_URL}/api/admin/stats`, {
      headers: { 'x-admin-token': 'invalid-token' },
    });
    check(res, { 'Admin Protected': (r) => r.status === 403 });
    apiTrend.add(res.timings.duration);
    sleep(0.3);
  });

  group('Health Check', () => {
    const res = http.get(`${API_URL}/api/health`);
    check(res, { 'Health OK': (r) => r.status === 200 });
    apiTrend.add(res.timings.duration);
    sleep(0.2);
  });
}