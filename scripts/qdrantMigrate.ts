import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ url: process.env.QDRANT_URL,
                                  apiKey: process.env.QDRANT_API_KEY });

const collections = [
  { name: 'journal_entries', vectors: { size: 1536, distance: 'Cosine' as const } },
  { name: 'persona_memory',  vectors: { size: 1536, distance: 'Cosine' as const } },
  { name: 'public_knowledge',vectors: { size: 1536, distance: 'Cosine' as const } }
];

(async () => {
  for (const c of collections) {
    const exists = await client.getCollections()
                               .then(r => r.collections.find(x => x.name === c.name));
    if (!exists) {
      await client.createCollection(c.name, c);
      console.log(`✅ Created ${c.name}`);
    } else {
      console.log(`↺ Skipped ${c.name} (already exists)`);
    }
  }

  console.log('Migration complete ✅')
})();
