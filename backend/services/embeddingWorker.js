const { supabaseAdmin } = require('../config/supabase');
const { VectorEmbeddingService, EMBEDDING_CONFIG } = require('./vectorService');
const config = require('../config/env');

class EmbeddingWorker {
  constructor({ intervalMs = parseInt(process.env.EMBEDDING_WORKER_INTERVAL_MS) || 60000, batchSize = EMBEDDING_CONFIG.batchSize || 50 } = {}) {
    this.intervalMs = intervalMs;
    this.batchSize = batchSize;
    this.running = false;
    this.timer = null;
    this.vectorService = new VectorEmbeddingService();
    this._lock = false;
  }

  async runOnce() {
    if (this._lock) return;
    this._lock = true;
    try {
      console.log('[EmbeddingWorker] Checking for entities missing embeddings...');

      // Fetch entities where embedding is NULL
      const { data: entities, error } = await supabaseAdmin
        .from('knowledge_entities')
        .select('id,user_id,entity_name,category,context')
        .is('embedding', null)
        .order('created_at', { ascending: true })
        .limit(this.batchSize);

      if (error) {
        console.error('[EmbeddingWorker] Supabase fetch error:', error.message || error);
        return;
      }

      if (!entities || entities.length === 0) {
        // nothing to do
        return;
      }

      console.log(`[EmbeddingWorker] Found ${entities.length} entities to embed.`);

      // Prepare texts
      const texts = entities.map((e) => `${e.entity_name} ${e.category} ${e.context || ''}`);

      // Generate batch embeddings
      const embeddings = await this.vectorService.generateEmbeddingsBatch(texts);

      // Upsert each embedding
      for (let i = 0; i < entities.length; i++) {
        const ent = entities[i];
        const emb = embeddings[i];
        if (!emb || emb.length === 0) continue;

        try {
          await supabaseAdmin.from('entity_embeddings').upsert({
            entity_id: ent.id,
            user_id: ent.user_id,
            embedding: emb,
            embedding_model: EMBEDDING_CONFIG.model,
            embedding_created_at: new Date().toISOString(),
          });

          await supabaseAdmin
            .from('knowledge_entities')
            .update({ embedding: emb })
            .eq('id', ent.id);

          console.log(`[EmbeddingWorker] Embedded entity ${ent.id} (${ent.entity_name})`);
        } catch (upsertErr) {
          console.error('[EmbeddingWorker] Upsert error for', ent.id, upsertErr.message || upsertErr);
        }
      }
    } catch (err) {
      console.error('[EmbeddingWorker] Unexpected error:', err);
    } finally {
      this._lock = false;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    // Run immediately, then schedule
    this.runOnce().catch((e) => console.error('[EmbeddingWorker] runOnce error:', e));
    this.timer = setInterval(() => this.runOnce().catch((e) => console.error('[EmbeddingWorker] runOnce error:', e)), this.intervalMs);
    console.log(`[EmbeddingWorker] Started — interval: ${this.intervalMs}ms, batchSize: ${this.batchSize}`);
  }

  stop() {
    if (!this.running) return;
    clearInterval(this.timer);
    this.running = false;
    console.log('[EmbeddingWorker] Stopped');
  }
}

module.exports = { EmbeddingWorker };
