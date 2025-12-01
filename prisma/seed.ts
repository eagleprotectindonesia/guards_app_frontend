import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Site
  const site = await prisma.site.create({
    data: {
      name: 'Headquarters',
      timeZone: 'America/New_York',
    },
  });
  console.log('Created Site:', site.id);

  // 2. Create Post
  const post = await prisma.post.create({
    data: {
      siteId: site.id,
      name: 'Main Gate',
      requiredHeadcount: 1,
    },
  });
  console.log('Created Post:', post.id);

  // 3. Create User (Guard)
  const user = await prisma.user.create({
    data: {
      name: 'John Guard',
      email: 'john@guard.com',
      role: 'guard',
    },
  });
  console.log('Created User:', user.id);

  // 4. Create Shift (Active Now)
  const now = new Date();
  const startsAt = new Date(now.getTime() - 30 * 60000); // Started 30 mins ago
  const endsAt = new Date(now.getTime() + 4 * 60 * 60000); // Ends in 4 hours

  const shift = await prisma.shift.create({
    data: {
      postId: post.id,
      userId: user.id,
      status: 'assigned',
      startsAt,
      endsAt,
      requiredCheckinIntervalMins: 1, // Short interval for testing (1 min)
      graceMinutes: 1, // Short grace
    },
  });
  console.log('Created Shift:', shift.id);

  console.log('\n--- SEED COMPLETE ---');
  console.log(`Guard User ID (Use this in Guard UI): ${user.id}`);
  console.log(`Site ID (Use this in Admin Dashboard): ${site.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
