const { PrismaClient } = require('@prisma/client');

async function testUrl(name, url) {
  console.log(`\nTesting ${name}...`);
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    const start = Date.now();
    await client.$connect();
    const connectTime = Date.now() - start;

    const qStart = Date.now();
    const count = await client.customer.count();
    const queryTime = Date.now() - qStart;

    console.log(`SUCCESS: ${name} -> Connect: ${connectTime}ms | Query: ${queryTime}ms | Customers: ${count}`);
    await client.$disconnect();
    return true;
  } catch (err) {
    console.error(`FAILED: ${name} -> ${err.message.split('\n')[0]}`);
    await client.$disconnect().catch(() => {});
    return false;
  }
}

(async () => {
  console.log('=== TESTING SUPABASE CONNECTION HOSTS ===');
  await testUrl('Pooler (6543)', "postgresql://postgres.cwnwxdbzjvuquuiakypw:Vydesh%409032231615@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require");
  await testUrl('Direct Supabase Domain (5432)', "postgresql://postgres:Vydesh%409032231615@db.cwnwxdbzjvuquuiakypw.supabase.co:5432/postgres?sslmode=require");
  await testUrl('Pooler Direct (5432)', "postgresql://postgres.cwnwxdbzjvuquuiakypw:Vydesh%409032231615@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require");
  console.log('========================================');
})();
