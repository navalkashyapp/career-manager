import { adminDb } from '../src/lib/firebaseAdmin';

export const INITIAL_JOB_URLS = [
  {
    url: 'https://jobs.careers.microsoft.com/global/en/job/1765288/Senior-Technical-Program-Manager',
    targetRole: 'Senior Technical Program Manager - Azure & Cloud AI',
    company: 'Microsoft',
    location: 'Redmond, WA / Vancouver, BC (Hybrid/Remote)',
  },
  {
    url: 'https://amazon.jobs/en/jobs/2784512/senior-technical-program-manager-aws-ai-platforms',
    targetRole: 'Senior Technical Program Manager - AWS GenAI Platforms',
    company: 'Amazon Web Services (AWS)',
    location: 'Seattle, WA / Vancouver, BC',
  },
  {
    url: 'https://www.metacareers.com/jobs/1083928172948291/technical-program-manager-infrastructure/',
    targetRole: 'Technical Program Manager - Infrastructure & Foundation Models',
    company: 'Meta',
    location: 'Bellevue, WA / Remote',
  },
  {
    url: 'https://www.google.com/about/careers/applications/jobs/results/12839482918274-staff-technical-program-manager-cloud',
    targetRole: 'Staff Technical Program Manager - Cloud Infrastructure & Distributed Systems',
    company: 'Google',
    location: 'Seattle, WA / Vancouver, BC',
  },
  {
    url: 'https://stripe.com/jobs/listing/technical-program-manager-infrastructure/6284918',
    targetRole: 'Technical Program Manager - Global Platform Infrastructure',
    company: 'Stripe',
    location: 'Remote (US / Canada)',
  },
  {
    url: 'https://careers.snowflake.com/us/en/job/6391827/Senior-Technical-Program-Manager',
    targetRole: 'Senior Technical Program Manager - Core Database & Cloud Engine',
    company: 'Snowflake',
    location: 'Bellevue, WA / Remote',
  },
  {
    url: 'https://openai.com/careers/technical-program-manager-infrastructure',
    targetRole: 'Technical Program Manager - Supercomputing & Scaling Systems',
    company: 'OpenAI',
    location: 'San Francisco, CA / Remote',
  },
  {
    url: 'https://jobs.ashbyhq.com/anthropic/4819283-technical-program-manager',
    targetRole: 'Technical Program Manager - Core Systems & AI Reliability',
    company: 'Anthropic',
    location: 'Seattle, WA / San Francisco, CA / Remote',
  },
];

async function seed() {
  console.log('Seeding job URLs to Firestore...');

  const usersSnap = await adminDb.collection('users').get();
  if (usersSnap.empty) {
    console.log('No users found in Firestore.');
    return;
  }

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    console.log(`Processing user: ${userId}`);

    const jobUrlsRef = adminDb.collection('users').doc(userId).collection('job_urls');
    const existingSnap = await jobUrlsRef.get();
    const existingUrls = new Set(existingSnap.docs.map((d) => d.data().url));

    let addedCount = 0;
    for (const item of INITIAL_JOB_URLS) {
      if (!existingUrls.has(item.url)) {
        const newDocRef = jobUrlsRef.doc();
        await newDocRef.set({
          id: newDocRef.id,
          url: item.url,
          targetRole: item.targetRole,
          company: item.company,
          location: item.location,
          status: 'pending',
          addedAt: Date.now(),
        });
        addedCount++;
        console.log(`  + Added: [${item.company}] ${item.targetRole}`);
      } else {
        console.log(`  ~ Already exists: [${item.company}] ${item.targetRole}`);
      }
    }

    console.log(`User ${userId}: Seeded ${addedCount} new job URLs.`);
  }

  console.log('Done!');
}

seed().catch(console.error);
