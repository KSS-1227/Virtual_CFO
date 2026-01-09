const { getAuthenticatedClient } = require("../config/supabase");
const { asyncHandler } = require("../middleware/errorHandler");
const { AudioConfirmationService } = require("../services/audioConfirmationService");
const { ReorderIntelligenceService } = require("../services/reorderIntelligenceService");
const { notificationService } = require("../services/notificationService");
const { PerformanceOptimizationService } = require("../services/performanceOptimizationService");

// Helper: compute current stock per item from ledger rows
const computeCurrentStock = (rows) => {
  const totals = new Map();
  for (const row of rows) {
    const key = row.item_id;
    const prev = totals.get(key) || 0;
    const delta = row.direction === "in" ? Number(row.quantity || 0) : -Number(row.quantity || 0);
    totals.set(key, prev + delta);
  }
  return totals;
};

// GET /api/inventory/items
const listItems = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  // Use the new view for cleaner data
  const { data: items, error } = await supabase
    .from("inventory_items_with_stock")
    .select("id, product_name, aliases, unit, brand, category, custom_attributes, notes, current_stock, created_at, updated_at")
    .eq("user_id", req.user.id)
    .order("product_name", { ascending: true });

  if (error) {
    console.error("Inventory listItems error:", error);
    return res.status(500).json({ success: false, error: "Failed to load inventory items" });
  }

  // Format response with clear field meanings
  const formattedItems = (items || []).map((item) => ({
    ...item,
    quantity: item.current_stock, // Standardize field name
    unit_of_measurement: item.unit, // Clarify purpose
    stock: item.current_stock // Keep for backward compatibility
  }));

  res.json({ success: true, data: formattedItems });
});

// POST /api/inventory/items
// Creates a new item or updates existing one by id
const createOrUpdateItem = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id, product_name, unit, brand, category, aliases, custom_attributes, notes } = req.body || {};

  if (!product_name || typeof product_name !== "string" || !product_name.trim()) {
    return res.status(400).json({ success: false, error: "product_name is required" });
  }

  const payload = {
    user_id: req.user.id,
    product_name: product_name.trim(),
    unit: unit || null,
    brand: brand || null,
    category: category || null,
    aliases: Array.isArray(aliases) ? aliases : undefined,
    custom_attributes: custom_attributes || undefined,
    notes: notes || null,
  };

  let result;
  if (id) {
    const { data, error } = await supabase
      .from("inventory_items")
      .update(payload)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("*")
      .single();

    if (error) {
      console.error("Inventory update error:", error);
      return res.status(500).json({ success: false, error: "Failed to update item" });
    }
    result = data;
  } else {
    const { data, error } = await supabase
      .from("inventory_items")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Inventory create error:", error);
      return res.status(500).json({ success: false, error: "Failed to create item" });
    }
    result = data;
  }

  res.json({ success: true, data: result });
});

// GET /api/inventory/items/:id
const getItem = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;

  const { data: item, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", req.user.id)
    .single();

  if (error || !item) {
    return res.status(404).json({ success: false, error: "Item not found" });
  }

  const { data: ledgerRows, error: ledgerError } = await supabase
    .from("inventory_stock_ledger")
    .select("direction, quantity, source, reference_id, metadata, created_at")
    .eq("user_id", req.user.id)
    .eq("item_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (ledgerError) {
    console.error("Inventory getItem ledger error:", ledgerError);
  }

  const stockMap = ledgerRows ? computeCurrentStock(ledgerRows) : new Map();

  res.json({
    success: true,
    data: {
      ...item,
      current_stock: stockMap.get(item.id) || 0,
      recent_movements: ledgerRows || [],
    },
  });
});

// DELETE /api/inventory/items/:id
const deleteItem = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { id } = req.params;

  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", id)
    .eq("user_id", req.user.id);

  if (error) {
    console.error("Inventory delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete item" });
  }

  res.json({ success: true, message: "Item deleted" });
});

// POST /api/inventory/movements
// Body: { item_id, product_name?, direction, quantity, source?, reference_id?, metadata? }
// If item_id missing but product_name provided, will upsert item first (zero-assumption flow).
const recordStockMovement = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);
  const { item_id, product_name, direction, quantity, source, reference_id, metadata } = req.body || {};

  if (!direction || !["in", "out"].includes(direction)) {
    return res.status(400).json({ success: false, error: "direction must be 'in' or 'out'" });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ success: false, error: "quantity must be a positive number" });
  }

  let resolvedItemId = item_id || null;

  // Zero-assumption: if no item_id but product_name given, upsert an inventory_items row.
  if (!resolvedItemId && product_name) {
    const { data: existing, error: findError } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("user_id", req.user.id)
      .ilike("product_name", product_name.trim());

    if (findError) {
      console.error("Inventory find item by name error:", findError);
    }

    if (existing && existing.length > 0) {
      resolvedItemId = existing[0].id;
    } else {
      const { data: created, error: createError } = await supabase
        .from("inventory_items")
        .insert({
          user_id: req.user.id,
          product_name: product_name.trim(),
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Inventory auto-create item error:", createError);
        return res.status(500).json({ success: false, error: "Failed to create inventory item" });
      }
      resolvedItemId = created.id;
    }
  }

  if (!resolvedItemId) {
    return res.status(400).json({ success: false, error: "item_id or product_name is required" });
  }

  // === User pattern learning: maintain aliases for different spoken names ===
  if (product_name && resolvedItemId) {
    try {
      const { data: item } = await supabase
        .from("inventory_items")
        .select("product_name, aliases")
        .eq("id", resolvedItemId)
        .eq("user_id", req.user.id)
        .single();

      if (item) {
        const canonical = (item.product_name || "").trim().toLowerCase();
        const incoming = product_name.trim().toLowerCase();
        const existingAliases = Array.isArray(item.aliases) ? item.aliases : [];
        const aliasSet = new Set(existingAliases.map((a) => (a || "").trim().toLowerCase()));

        if (incoming !== canonical && !aliasSet.has(incoming)) {
          const updatedAliases = [...existingAliases, product_name.trim()];
          await supabase
            .from("inventory_items")
            .update({ aliases: updatedAliases })
            .eq("id", resolvedItemId)
            .eq("user_id", req.user.id);
        }
      }
    } catch (aliasErr) {
      console.error("Inventory alias learning error:", aliasErr);
    }
  }

  const payload = {
    user_id: req.user.id,
    item_id: resolvedItemId,
    direction,
    quantity: qty,
    source: source || "manual",
    reference_id: reference_id || null,
    metadata: metadata || {},
  };

  const { data, error } = await supabase
    .from("inventory_stock_ledger")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Inventory recordStockMovement error:", error);
    return res.status(500).json({ success: false, error: "Failed to record stock movement" });
  }

  // Generate audio confirmation
  const audioService = new AudioConfirmationService();
  const audioConfirmation = await audioService.generateInventoryConfirmation(
    req.user.id, 
    direction, 
    product_name || 'item', 
    qty, 
    'units'
  );

  // Send real-time notification
  notificationService.notifyStockUpdate(req.user.id, {
    product_name: product_name || 'item',
    current_stock: qty,
    operation: direction === 'in' ? 'added' : 'removed'
  }, direction);

  res.json({ 
    success: true, 
    data,
    audio_confirmation: audioConfirmation?.audio ? 'data:audio/mp3;base64,' + audioConfirmation.audio : null
  });
});

// GET /api/inventory/summary
// Returns per-item current stock and simple low-stock flags.
const getInventorySummary = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  const [{ data: items, error: itemsError }, { data: ledgerRows, error: ledgerError }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, product_name, unit, brand, category")
      .eq("user_id", req.user.id),
    supabase
      .from("inventory_stock_ledger")
      .select("item_id, direction, quantity")
      .eq("user_id", req.user.id),
  ]);

  if (itemsError || ledgerError) {
    console.error("Inventory summary error:", itemsError || ledgerError);
    return res.status(500).json({ success: false, error: "Failed to load inventory summary" });
  }

  const stockMap = computeCurrentStock(ledgerRows || []);

  const summary = (items || []).map((item) => {
    const current = stockMap.get(item.id) || 0;
    // Simple heuristic: low stock if <= 0
    const isLow = current <= 0;
    return {
      ...item,
      current_stock: current,
      is_low_stock: isLow,
    };
  });

  res.json({ success: true, data: { items: summary } });
});

// GET /api/inventory/insights
// Basic insights: counts, low-stock items, slow movers (no movement in last 30 days)
const getInventoryInsights = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedClient(req.accessToken);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: items, error: itemsError }, { data: ledgerRows, error: ledgerError }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, product_name, unit, brand, category")
      .eq("user_id", req.user.id),
    supabase
      .from("inventory_stock_ledger")
      .select("item_id, direction, quantity, created_at")
      .eq("user_id", req.user.id),
  ]);

  if (itemsError || ledgerError) {
    console.error("Inventory insights error:", itemsError || ledgerError);
    return res.status(500).json({ success: false, error: "Failed to load inventory insights" });
  }

  const stockMap = computeCurrentStock(ledgerRows || []);

  const lowStockItems = [];
  const slowMovers = [];

  const movementsByItem = new Map();
  for (const row of ledgerRows || []) {
    const list = movementsByItem.get(row.item_id) || [];
    list.push(row);
    movementsByItem.set(row.item_id, list);
  }

  for (const item of items || []) {
    const current = stockMap.get(item.id) || 0;
    const movements = movementsByItem.get(item.id) || [];

    const isLow = current <= 0;
    if (isLow) {
      lowStockItems.push({ ...item, current_stock: current });
    }

    const hasRecentMovement = movements.some((m) => m.created_at >= thirtyDaysAgo);
    if (!hasRecentMovement && movements.length > 0) {
      slowMovers.push({ ...item, current_stock: current });
    }
  }

  res.json({
    success: true,
    data: {
      total_items: items?.length || 0,
      low_stock_count: lowStockItems.length,
      slow_mover_count: slowMovers.length,
      low_stock_items: lowStockItems.slice(0, 10),
      slow_movers: slowMovers.slice(0, 10),
    },
  });
});

module.exports = {
  listItems,
  createOrUpdateItem,
  getItem,
  deleteItem,
  recordStockMovement,
  getInventorySummary,
  getInventoryInsights,
};
