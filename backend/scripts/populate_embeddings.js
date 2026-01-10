const path = require('path');
// Load backend/.env explicitly so dotenv sees the variables when started from project root
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
// Then validate and load config
require(path.join(__dirname, '..', 'config', 'env'));

const { supabaseAdmin } = require('../config/supabase');
const { VectorEmbeddingService, EMBEDDING_CONFIG } = require('../services/vectorService');

async function main() {
  const vector = new VectorEmbeddingService();

  console.log('[populate_embeddings] Fetching entities from Supabase...');
  const { data: entities, error } = await supabaseAdmin
    .from('knowledge_entities')
    .select('*')
    .limit(100000);

  if (error) {
    console.error('[populate_embeddings] Supabase error:', error);
    process.exit(1);
  }

  if (!entities || entities.length === 0) {
    console.log('[populate_embeddings] No entities found. Exiting.');
    process.exit(0);
  }

  console.log(`[populate_embeddings] Found ${entities.length} entities. Starting embedding generation...`);

  let success = 0;
  let failed = 0;

  for (const entity of entities) {
    try {
      const text = `${entity.entity_name} ${entity.category} ${entity.context || ''}`;
      const embedding = await vector.generateEmbedding(text);

      await supabaseAdmin.from('entity_embeddings').upsert({
        entity_id: entity.id,
        user_id: entity.user_id,
        embedding: embedding,
        embedding_model: EMBEDDING_CONFIG.model,
        embedding_created_at: new Date().toISOString(),
      });

      await supabaseAdmin
        .from('knowledge_entities')
        .update({ embedding })
        .eq('id', entity.id);

      success++;
      if (success % 50 === 0) {
        console.log(`[populate_embeddings] ${success} embeddings stored...`);
      }
    } catch (err) {
      console.error(`[populate_embeddings] Failed for entity ${entity.id}:`, err.message || err);
      failed++;
    }
  }

  console.log(`[populate_embeddings] Done. Success: ${success}, Failed: ${failed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[populate_embeddings] Fatal error:', err);
  process.exit(1);
});
