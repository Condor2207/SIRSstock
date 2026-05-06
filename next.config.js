/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    remotePatterns: [],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://lmqkzrbyppyhkgtttqie.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtcWt6cmJ5cHB5aGtndHR0cWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTc0MTYsImV4cCI6MjA5MzU3MzQxNn0.iquSQVSIpqGANHRtDpsxkfWdFnxNIwRXGUR8ZwUNJRY',
  },
};

module.exports = nextConfig;
