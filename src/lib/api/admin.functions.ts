import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server function: Get Admin Dashboard KPI stats and recent lists
export const getAdminDashboardData = createServerFn({ method: "GET" })
  .handler(async () => {
    // 0. Auth & Authorization Guard (dynamically imported to prevent leaking to client)
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // 1. Parallel KPI Queries using Promise.all
    const [
      revenueRes,
      ordersTodayRes,
      pendingQuoRes,
      activeServRes,
      forumPostsRes,
      registeredFarmersRes
    ] = await Promise.all([
      sql`
        SELECT COALESCE(SUM(total), 0) as total_revenue
        FROM orders
        WHERE payment_status = 'paid' AND deleted_at IS NULL
      `,
      sql`
        SELECT COUNT(*) as count
        FROM orders
        WHERE created_at >= CURRENT_DATE AND deleted_at IS NULL
      `,
      sql`
        SELECT COUNT(*) as count
        FROM quotations
        WHERE status = 'pending'
      `,
      sql`
        SELECT COUNT(*) as count
        FROM service_requests
        WHERE status IN ('requested', 'assigned', 'in_progress')
      `,
      sql`
        SELECT COUNT(*) as count
        FROM show_posts
      `,
      sql`
        SELECT COUNT(*) as count
        FROM profiles
        WHERE role = 'farmer' AND deleted_at IS NULL
      `
    ]);

    const totalRevenueVal = parseFloat(revenueRes[0]?.total_revenue || "0");
    const totalRevenue = `KES ${(totalRevenueVal / 1000).toFixed(1)}k`;
    const ordersToday = ordersTodayRes[0]?.count || 0;
    const pendingQuotations = pendingQuoRes[0]?.count || 0;
    const activeServiceRequests = activeServRes[0]?.count || 0;
    const forumPostsCount = forumPostsRes[0]?.count || 0;
    const registeredFarmers = registeredFarmersRes[0]?.count || 0;

    // 7. Recent Orders
    const recentOrders = await sql`
      SELECT 
        o.id,
        p.full_name as customer,
        o.total,
        o.status,
        o.created_at
      FROM orders o
      JOIN profiles p ON o.user_id = p.id
      WHERE o.deleted_at IS NULL AND p.deleted_at IS NULL
      ORDER BY o.created_at DESC
      LIMIT 5
    `;

    // 8. Recent Service Requests
    const recentServiceRequests = await sql`
      SELECT 
        sr.id,
        s.name as service,
        p.full_name as farmer,
        sr.status,
        p.county_region as county
      FROM service_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN profiles p ON sr.user_id = p.id
      WHERE p.deleted_at IS NULL
      ORDER BY sr.created_at DESC
      LIMIT 5
    `;

    return {
      kpis: [
        { label: "Total Revenue", value: totalRevenue, change: "+12.5%", positive: true, icon: "DollarSign" },
        { label: "Orders Today", value: String(ordersToday), change: "+8", positive: true, icon: "ShoppingBag" },
        { label: "Pending Quotations", value: String(pendingQuotations), change: "-2", positive: false, icon: "AlertCircle" },
        { label: "Active Service Requests", value: String(activeServiceRequests), change: "+3", positive: true, icon: "Activity" },
        { label: "Forum Posts", value: String(forumPostsCount), change: "0", positive: true, icon: "MessageSquare" },
        { label: "Registered Farmers", value: String(registeredFarmers), change: "+156", positive: true, icon: "Users" },
      ],
      recentOrders: recentOrders.map(o => ({
        id: String(o.id).substring(0, 8).toUpperCase(),
        customer: o.customer,
        total: `KES ${parseFloat(o.total).toLocaleString()}`,
        status: o.status,
        time: formatRelativeTime(new Date(o.created_at)),
      })),
      recentServiceRequests: recentServiceRequests.map(sr => ({
        id: sr.id,
        service: sr.service,
        farmer: sr.farmer,
        status: sr.status,
        county: sr.county || "Unknown",
      })),
    };
  });

const AdminOrdersInputSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().optional().default(50)
});

// Server function: Get all orders
export const getAdminOrders = createServerFn({ method: "GET" })
  .inputValidator((val: unknown) => AdminOrdersInputSchema.parse(val || {}))
  .handler(async ({ data }) => {
    const { page = 1, limit = 50 } = data;
    // 0. Auth & Authorization Guard
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const offset = (page - 1) * limit;

    const ordersRes = await sql`
      SELECT 
        o.id,
        p.full_name as customer,
        o.items,
        o.total,
        o.subtotal,
        o.payment_status,
        o.status,
        o.checkout_channel as channel,
        o.created_at,
        o.delivery_address,
        o.notes,
        COALESCE(
          (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id),
          0
        ) as items_count
      FROM orders o
      JOIN profiles p ON o.user_id = p.id
      WHERE o.deleted_at IS NULL AND p.deleted_at IS NULL
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRes = await sql`
      SELECT COUNT(*) as count FROM orders WHERE deleted_at IS NULL
    `;
    const total = parseInt(totalRes[0]?.count || "0");

    const orders = ordersRes.map(o => {
      // Calculate item count
      const itemsList = Array.isArray(o.items) ? o.items : [];
      const jsonItemsCount = itemsList.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
      const itemsCount = Number(o.items_count) > 0 ? Number(o.items_count) : jsonItemsCount;

      return {
        id: String(o.id).substring(0, 8).toUpperCase(),
        rawId: o.id,
        customer: o.customer,
        items: itemsCount,
        total: `KES ${parseFloat(o.total).toLocaleString()}`,
        subtotal: `KES ${parseFloat(o.subtotal || "0").toLocaleString()}`,
        payment: o.payment_status,
        status: o.status,
        channel: o.channel,
        date: new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        deliveryAddress: o.delivery_address,
        notes: o.notes,
        rawItems: itemsList
      };
    });

    return {
      orders,
      total,
      page
    };
  });

// Server function: Get service requests by category (Kanban columns)
export const getAdminServiceRequests = createServerFn({ method: "GET" })
  .handler(async () => {
    // 0. Auth & Authorization Guard
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();
    const requests = await sql`
      SELECT 
        sr.id,
        s.name as service,
        p.full_name as farmer,
        p.county_region as county,
        sr.status,
        sr.created_at
      FROM service_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN profiles p ON sr.user_id = p.id
      ORDER BY sr.created_at DESC
    `;

    const columns = [
      { title: "Requested", color: "amber", status: "requested", items: [] as any[] },
      { title: "Assigned", color: "blue", status: "assigned", items: [] as any[] },
      { title: "In Progress", color: "purple", status: "in_progress", items: [] as any[] },
      { title: "Completed", color: "emerald", status: "completed", items: [] as any[] },
    ];

    requests.forEach(req => {
      const col = columns.find(c => c.status === req.status);
      if (col) {
        col.items.push({
          id: req.id,
          service: req.service,
          farmer: req.farmer,
          county: req.county || "Unknown",
          date: new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        });
      }
    });

    return columns;
  });

// Server function: Get products
export const getAdminProducts = createServerFn({ method: "GET" })
  .handler(async () => {
    // 0. Auth & Authorization Guard
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();
    const products = await sql`
      SELECT 
        p.id,
        p.name,
        COALESCE(sc.name, pc.name) as category,
        p.subcategory,
        p.description,
        p.brief_description as "briefDescription",
        p.base_price as price,
        p.original_price as "originalPrice",
        p.image_urls,
        p.stock_qty as stock,
        p.brand,
        p.seller,
        p.county,
        p.organic,
        p.verified_seller as "verifiedSeller",
        p.badge,
        p.status,
        p.unit,
        p.shop_type as "shopType",
        p.avg_rating as rating,
        p.is_featured as "isFeatured"
      FROM products p
      LEFT JOIN shop_categories sc ON p.category_id = sc.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.name ASC
    `;

    return products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category || "Seeds & Seedlings",
      subcategory: p.subcategory || "",
      description: p.description || "",
      briefDescription: p.briefDescription || "",
      price: Number(p.price || 0),
      originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
      stock: Number(p.stock || 0),
      image: (Array.isArray(p.image_urls) && p.image_urls.length > 0) ? p.image_urls[0] : "/placeholder-product.png",
      imageUrls: Array.isArray(p.image_urls) ? p.image_urls : [],
      brand: p.brand || "Generic",
      seller: p.seller || "Mqulima Partner",
      county: p.county || null,
      organic: !!p.organic,
      verifiedSeller: !!p.verifiedSeller,
      badge: p.badge || "",
      status: p.status,
      unit: p.unit || "/unit",
      shopType: p.shopType || "Agrovet",
      rating: Number(p.rating !== undefined && p.rating !== null ? p.rating : 0),
      isFeatured: !!p.isFeatured
    }));
  });

// Server function: Create admin product
export const createAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().min(1),
    brand: z.string().optional().default("Generic"),
    price: z.number().positive(),
    originalPrice: z.number().nullable().optional(),
    stock: z.number().int().nonnegative().default(10),
    image: z.string().optional().default("/placeholder-product.png"),
    images: z.array(z.string()).optional(),
    description: z.string().optional().default(""),
    briefDescription: z.string().optional().default(""),
    badge: z.string().optional().default(""),
    organic: z.boolean().optional().default(false),
    verifiedSeller: z.boolean().optional().default(true),
    shopType: z.enum(["agrovet", "specialist", "retailers"]).optional().default("agrovet"),
    unit: z.string().optional().default("/unit"),
    category: z.string().optional().default("Seeds & Seedlings"),
    subcategory: z.string().optional().default(""),
    rating: z.number().min(0).max(5).optional().default(0),
    isFeatured: z.boolean().optional().default(false),
    csrfToken: z.string()
  }))
  .handler(async ({ data }) => {
    // 1. CSRF Token Validation
    const { validateCsrfToken } = await import("../csrf-verify-functions");
    validateCsrfToken(data.csrfToken);

    // 2. Auth & Authorization Guard
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // Find category_id — use product_categories because products table has an FK to it
    let categoryId = null;
    if (data.category) {
      const [legacyCat] = await sql`SELECT id FROM product_categories WHERE name = ${data.category}`;
      if (legacyCat) {
        categoryId = legacyCat.id;
      } else {
        // Create in product_categories if not found anywhere
        const [newCat] = await sql`
          INSERT INTO product_categories (name, slug)
          VALUES (${data.category}, ${data.category.toLowerCase().replace(/[^a-z0-9]/g, "-")})
          RETURNING id
        `;
        categoryId = newCat.id;
      }
    }

    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();

    const imageList = data.images && data.images.length > 0 ? data.images : [data.image];

    const [product] = await sql`
      INSERT INTO products (
        name, slug, category_id, subcategory, description, brief_description, base_price, original_price,
        image_urls, stock_qty, brand, seller, county, organic, verified_seller,
        badge, status, unit, shop_type, avg_rating, rating_count, is_featured
      ) VALUES (
        ${data.name}, ${slug}, ${categoryId}, ${data.subcategory}, ${data.description}, ${data.briefDescription}, ${data.price}, ${data.originalPrice || null},
        ${imageList}, ${data.stock}, ${data.brand}, 'Mqulima Partner', null, ${data.organic}, ${data.verifiedSeller},
        ${data.badge}, 'active', ${data.unit}, ${data.shopType}, ${data.rating}, ${data.rating > 0 ? 1 : 0}, ${data.isFeatured}
      )
      RETURNING id, name
    `;

    // Write Audit Log
    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "product.created",
      entityType: "product",
      entityId: product.id,
      diff: { name: data.name, price: data.price }
    });

    return { success: true, product };
  });

// Server function: Update admin product
export const updateAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string(),
    name: z.string().optional(),
    brand: z.string().optional(),
    price: z.number().positive().optional(),
    originalPrice: z.number().nullable().optional(),
    stock: z.number().int().nonnegative().optional(),
    image: z.string().optional(),
    images: z.array(z.string()).optional(),
    description: z.string().optional(),
    briefDescription: z.string().optional(),
    badge: z.string().optional(),
    organic: z.boolean().optional(),
    verifiedSeller: z.boolean().optional(),
    shopType: z.enum(["agrovet", "specialist", "retailers"]).optional(),
    unit: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    rating: z.number().min(0).max(5).optional(),
    isFeatured: z.boolean().optional(),
    csrfToken: z.string()
  }))
  .handler(async ({ data }) => {
    // 1. CSRF Token Validation
    const { validateCsrfToken } = await import("../csrf-verify-functions");
    validateCsrfToken(data.csrfToken);

    // 2. Auth & Authorization Guard
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // Verify product exists
    const [existing] = await sql`SELECT id, name, stock_qty FROM products WHERE id = ${data.id}`;
    if (!existing) throw new Error("Product not found");

    // Resolve category_id — use product_categories because of strict FK constraint
    let categoryId = undefined;
    if (data.category) {
      const [legacyCat] = await sql`SELECT id FROM product_categories WHERE name = ${data.category}`;
      if (legacyCat) {
        categoryId = legacyCat.id;
      } else {
        const [newCat] = await sql`
          INSERT INTO product_categories (name, slug)
          VALUES (${data.category}, ${data.category.toLowerCase().replace(/[^a-z0-9]/g, "-")})
          RETURNING id
        `;
        categoryId = newCat.id;
      }
    }

    const updateObj: any = {};
    if (data.name !== undefined) updateObj.name = data.name;
    if (data.brand !== undefined) updateObj.brand = data.brand;
    if (data.price !== undefined) updateObj.base_price = data.price;
    if (data.originalPrice !== undefined) updateObj.original_price = data.originalPrice;
    if (data.stock !== undefined) updateObj.stock_qty = data.stock;
    if (data.rating !== undefined) {
      updateObj.avg_rating = data.rating;
      updateObj.rating_count = data.rating > 0 ? 1 : 0;
    }
    if (data.images !== undefined) {
      updateObj.image_urls = data.images;
    } else if (data.image !== undefined) {
      updateObj.image_urls = [data.image];
    }
    if (data.description !== undefined) updateObj.description = data.description;
    if (data.briefDescription !== undefined) updateObj.brief_description = data.briefDescription;
    if (data.badge !== undefined) updateObj.badge = data.badge;
    if (data.organic !== undefined) updateObj.organic = data.organic;
    if (data.verifiedSeller !== undefined) updateObj.verified_seller = data.verifiedSeller;
    if (data.shopType !== undefined) updateObj.shop_type = data.shopType;
    if (data.unit !== undefined) updateObj.unit = data.unit;
    if (categoryId !== undefined) updateObj.category_id = categoryId;
    if (data.subcategory !== undefined) updateObj.subcategory = data.subcategory;
    if (data.isFeatured !== undefined) updateObj.is_featured = data.isFeatured;

    await sql`
      UPDATE products
      SET ${sql(updateObj)}, updated_at = NOW()
      WHERE id = ${data.id}
    `;

    // Write Audit Log
    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "product.updated",
      entityType: "product",
      entityId: data.id,
      diff: { from: { stock: existing.stock_qty }, to: { stock: data.stock } }
    });

    return { success: true };
  });

// Server function: Delete admin product
export const deleteAdminProduct = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string(),
    csrfToken: z.string()
  }))
  .handler(async ({ data }) => {
    // 1. CSRF Token Validation
    const { validateCsrfToken } = await import("../csrf-verify-functions");
    validateCsrfToken(data.csrfToken);

    // 2. Auth & Authorization Guard
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // Verify product exists
    const [existing] = await sql`SELECT id, name FROM products WHERE id = ${data.id}`;
    if (!existing) throw new Error("Product not found");

    // Soft delete
    await sql`
      UPDATE products
      SET status = 'archived', deleted_at = NOW()
      WHERE id = ${data.id}
    `;

    // Write Audit Log
    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "product.deleted",
      entityType: "product",
      entityId: data.id,
      diff: { name: existing.name }
    });

    return { success: true };
  });

// Server function: Update order status
export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    orderId: z.string(),
    status: z.enum(["pending", "confirmed", "paid", "processing", "shipped", "delivered", "cancelled"]).optional(),
    paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
    csrfToken: z.string()
  }))
  .handler(async ({ data }) => {
    const { orderId, status, paymentStatus, csrfToken } = data;

    // 1. CSRF Token Validation
    const { validateCsrfToken } = await import("../csrf-verify-functions");
    validateCsrfToken(csrfToken);

    // 0. Auth & Authorization Guard (requires super_admin or admin role)
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    if (!["super_admin", "admin"].includes(actor.role)) {
      throw new Error("Unauthorized: Only administrators can update order status");
    }

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // 1. Verify order exists before mutating
    const [existingOrder] = await sql`
      SELECT id, status, payment_status FROM orders WHERE id = ${orderId}
    `;
    if (!existingOrder) {
      throw new Error("Order not found");
    }
    
    if (status && paymentStatus) {
      await sql`
        UPDATE orders
        SET status = ${status}, payment_status = ${paymentStatus}, updated_at = NOW()
        WHERE id = ${orderId}
      `;
    } else if (status) {
      await sql`
        UPDATE orders
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${orderId}
      `;
    } else if (paymentStatus) {
      await sql`
        UPDATE orders
        SET payment_status = ${paymentStatus}, updated_at = NOW()
        WHERE id = ${orderId}
      `;
    }

    // 2. Write Audit Log
    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "order.status_updated",
      entityType: "order",
      entityId: orderId,
      diff: {
        from: { status: existingOrder.status, payment_status: existingOrder.payment_status },
        to: { status: status || existingOrder.status, payment_status: paymentStatus || existingOrder.payment_status }
      }
    });

    return { success: true };
  });

// Server function: Update service request status
export const updateServiceRequestStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    requestId: z.string(),
    status: z.enum(["requested", "assigned", "in_progress", "completed", "cancelled"]),
    csrfToken: z.string()
  }))
  .handler(async ({ data }) => {
    const { requestId, status, csrfToken } = data;

    // 1. CSRF Token Validation
    const { validateCsrfToken } = await import("../csrf-verify-functions");
    validateCsrfToken(csrfToken);

    // 0. Auth & Authorization Guard (requires super_admin or admin role)
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    if (!["super_admin", "admin"].includes(actor.role)) {
      throw new Error("Unauthorized: Only administrators can update service requests");
    }

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // 1. Verify service request exists before mutating
    const [existingRequest] = await sql`
      SELECT id, status FROM service_requests WHERE id = ${requestId}
    `;
    if (!existingRequest) {
      throw new Error("Service request not found");
    }

    await sql`
      UPDATE service_requests
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${requestId}
    `;

    // 2. Write Audit Log
    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "service.status_updated",
      entityType: "service_request",
      entityId: requestId,
      diff: { from: existingRequest.status, to: status }
    });

    return { success: true };
  });

export const getMainAppUrl = createServerFn({ method: "GET" })
  .handler(async () => {
    return process.env.MAIN_APP_URL || "http://localhost:8080";
  });

export const getAdminUsers = createServerFn({ method: "GET" })
  .handler(async () => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    return sql`
      SELECT id, email, full_name, role, created_at, deleted_at
      FROM profiles
      WHERE role NOT IN ('farmer', 'retailer')
      ORDER BY created_at DESC
    `;
  });

export const createAdminUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: z.string().email(),
    fullName: z.string().min(1),
    password: z.string().min(6),
    role: z.enum(['super_admin', 'admin', 'sales_agent', 'content_editor'])
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();
    const bcrypt = await import("bcryptjs");

    const cleanEmail = data.email.trim().toLowerCase();

    // Check conflict
    const [existing] = await sql`SELECT 1 FROM profiles WHERE LOWER(email) = ${cleanEmail}`;
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const id = crypto.randomUUID();
    const baseUsername = 'mqulima_' + cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');

    await sql`
      INSERT INTO profiles (
        id, email, password_hash, full_name, username, role, created_at, updated_at
      ) VALUES (
        ${id}, ${cleanEmail}, ${passwordHash}, ${data.fullName.trim()}, ${baseUsername}, ${data.role}, NOW(), NOW()
      )
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "admin.create_user",
      entityType: "profile",
      entityId: id,
      diff: { email: cleanEmail, role: data.role }
    });

    return { success: true };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    userId: z.string().uuid(),
    role: z.enum(['super_admin', 'admin', 'sales_agent', 'content_editor', 'farmer', 'retailer'])
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { userId, role } = data;

    const [existing] = await sql`SELECT role FROM profiles WHERE id = ${userId}`;
    if (!existing) throw new Error("User not found");

    await sql`
      UPDATE profiles
      SET role = ${role}
      WHERE id = ${userId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "user.role_updated",
      entityType: "profile",
      entityId: userId,
      diff: { from: existing.role, to: role }
    });

    return { success: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    userId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { userId } = data;

    if (userId === actor.id) {
      throw new Error("Self-deletion is prohibited: You cannot delete your own admin account.");
    }

    await sql`
      UPDATE profiles
      SET deleted_at = NOW()
      WHERE id = ${userId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "user.deleted",
      entityType: "profile",
      entityId: userId,
      diff: {}
    });

    return { success: true };
  });

export const getAdminContent = createServerFn({ method: "GET" })
  .handler(async () => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    return sql`
      SELECT
        bp.id,
        bp.title,
        bp.slug,
        bp.category,
        bp.status,
        bp.view_count,
        bp.excerpt,
        bp.body,
        bp.cover_image,
        bp.published_at,
        bp.created_at,
        ba.id AS author_id,
        p.full_name AS author_name
      FROM blog_posts bp
      JOIN blog_authors ba ON ba.id = bp.author_id
      JOIN profiles p      ON p.id  = ba.profile_id
      ORDER BY bp.created_at DESC
    `;
  });

export const getAdminBlogAuthors = createServerFn({ method: "GET" })
  .handler(async () => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    return sql`
      SELECT ba.id, p.full_name AS name, ba.bio
      FROM blog_authors ba
      JOIN profiles p ON p.id = ba.profile_id
      WHERE ba.is_active = TRUE
      ORDER BY p.full_name
    `;
  });

export const createAdminBlogPost = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    title: z.string().min(5).max(300),
    category: z.string().min(1),
    excerpt: z.string().max(400).optional().default(""),
    body: z.string().min(10),
    coverImage: z.string().optional().default(""),
    authorId: z.string().uuid(),
    status: z.enum(["draft", "published"]).default("draft"),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // Generate slug from title
    const baseSlug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80);
    const slug = `${baseSlug}-${Date.now()}`;

    const publishedAt = data.status === "published" ? sql`NOW()` : null;

    const [created] = await sql`
      INSERT INTO blog_posts (author_id, title, slug, cover_image, excerpt, body, category, status, published_at)
      VALUES (
        ${data.authorId},
        ${data.title},
        ${slug},
        ${data.coverImage || null},
        ${data.excerpt || null},
        ${data.body},
        ${data.category},
        ${data.status},
        ${publishedAt}
      )
      RETURNING id, title, slug, category, status, published_at, created_at
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "blog.created",
      entityType: "blog_post",
      entityId: created.id as string,
      diff: { title: data.title, status: data.status }
    });

    return { success: true, post: created };
  });

export const toggleContentStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    postId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { postId } = data;

    const [post] = await sql`SELECT status FROM blog_posts WHERE id = ${postId}`;
    if (!post) throw new Error("Post not found");

    const newStatus = post.status === "published" ? "draft" : "published";

    await sql`
      UPDATE blog_posts
      SET status = ${newStatus}, published_at = ${newStatus === "published" ? sql`NOW()` : null}
      WHERE id = ${postId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "blog.status_updated",
      entityType: "blog_post",
      entityId: postId,
      diff: { from: post.status, to: newStatus }
    });

    return { success: true };
  });

export const deleteContent = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    postId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { postId } = data;

    await sql`
      DELETE FROM blog_posts
      WHERE id = ${postId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "blog.deleted",
      entityType: "blog_post",
      entityId: postId,
      diff: {}
    });

    return { success: true };
  });

export const updateAdminBlogPost = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    postId: z.string().uuid(),
    title: z.string().min(5).max(300),
    category: z.string().min(1),
    excerpt: z.string().max(400).optional().default(""),
    body: z.string().min(10),
    coverImage: z.string().optional().default(""),
    authorId: z.string().uuid(),
    status: z.enum(["draft", "published"]).default("draft"),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { postId, title, category, excerpt, body, coverImage, authorId, status } = data;

    const [existing] = await sql`SELECT id, status, published_at FROM blog_posts WHERE id = ${postId}`;
    if (!existing) throw new Error("Blog post not found");

    // Only set published_at when transitioning to published for first time
    const wasDraft = (existing.status as string) !== "published";
    const nowPublished = status === "published";

    await sql`
      UPDATE blog_posts
      SET
        title        = ${title},
        category     = ${category},
        excerpt      = ${excerpt || null},
        body         = ${body},
        cover_image  = ${coverImage || null},
        author_id    = ${authorId},
        status       = ${status},
        published_at = ${nowPublished && wasDraft ? sql`NOW()` : nowPublished ? sql`published_at` : sql`NULL`},
        updated_at   = NOW()
      WHERE id = ${postId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "blog.updated",
      entityType: "blog_post",
      entityId: postId,
      diff: { title, status }
    });

    return { success: true };
  });

export const getAdminForum = createServerFn({ method: "GET" })
  .handler(async () => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    return sql`
      SELECT sp.id, sp.title, sp.caption, sp.type, sp.like_count, sp.created_at, p.full_name as author_name
      FROM show_posts sp
      LEFT JOIN profiles p ON sp.user_id = p.id
      ORDER BY sp.created_at DESC
    `;
  });

export const deleteForumPost = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    postId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { postId } = data;

    await sql`
      DELETE FROM show_posts
      WHERE id = ${postId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "forum.post_deleted",
      entityType: "show_post",
      entityId: postId,
      diff: {}
    });

    return { success: true };
  });

export const getAdminAcademy = createServerFn({ method: "GET" })
  .handler(async () => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    return sql`
      SELECT
        c.id,
        c.title,
        c.slug,
        c.category,
        c.level,
        c.price,
        c.image_url,
        c.instructor_name,
        c.instructor_title,
        c.rating,
        c.student_count,
        c.duration,
        c.has_certificate,
        c.youtube_id,
        c.created_at
      FROM courses c
      ORDER BY c.created_at DESC
    `;
  });

export const deleteAcademyCourse = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    courseId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { courseId } = data;

    await sql`
      DELETE FROM courses
      WHERE id = ${courseId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "academy.course_deleted",
      entityType: "course",
      entityId: courseId,
      diff: {}
    });

    return { success: true };
  });

export const createAcademyCourse = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(10, "Description required"),
    category: z.string().min(1, "Category required"),
    level: z.enum(["beginner", "intermediate", "advanced", "all_levels"]),
    price: z.number().min(0).default(0),
    instructor_name: z.string().min(2, "Instructor name required"),
    instructor_title: z.string().optional().default(""),
    image_url: z.string().url("Must be a valid image URL").optional().or(z.literal("")),
    youtube_id: z.string().optional().default(""),
    duration: z.string().optional().default(""),
    has_certificate: z.boolean().default(false),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // Auto-generate slug from title
    const baseSlug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);

    // Ensure slug uniqueness by appending a timestamp suffix if needed
    const slug = `${baseSlug}-${Date.now()}`;

    const [course] = await sql`
      INSERT INTO courses (
        title, slug, description, category, level, price,
        instructor_name, instructor_title, image_url, youtube_id,
        duration, has_certificate, rating, student_count
      ) VALUES (
        ${data.title},
        ${slug},
        ${data.description},
        ${data.category},
        ${data.level},
        ${data.price},
        ${data.instructor_name},
        ${data.instructor_title || ""},
        ${data.image_url || null},
        ${data.youtube_id || null},
        ${data.duration || null},
        ${data.has_certificate},
        4.5,
        0
      )
      RETURNING id
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "academy.course_created",
      entityType: "course",
      entityId: course.id,
      diff: { title: data.title, category: data.category }
    });

    return { success: true, id: course.id };
  });

export const updateAcademyCourse = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    courseId: z.string().uuid(),
    title: z.string().min(3),
    description: z.string().min(10),
    category: z.string().min(1),
    level: z.enum(["beginner", "intermediate", "advanced", "all_levels"]),
    price: z.number().min(0),
    instructor_name: z.string().min(2),
    instructor_title: z.string().optional().default(""),
    image_url: z.string().url().optional().or(z.literal("")),
    youtube_id: z.string().optional().default(""),
    duration: z.string().optional().default(""),
    has_certificate: z.boolean().default(false),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { courseId, ...fields } = data;

    await sql`
      UPDATE courses
      SET
        title            = ${fields.title},
        description      = ${fields.description},
        category         = ${fields.category},
        level            = ${fields.level},
        price            = ${fields.price},
        instructor_name  = ${fields.instructor_name},
        instructor_title = ${fields.instructor_title || ""},
        image_url        = ${fields.image_url || null},
        youtube_id       = ${fields.youtube_id || null},
        duration         = ${fields.duration || null},
        has_certificate  = ${fields.has_certificate},
        updated_at       = NOW()
      WHERE id = ${courseId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "academy.course_updated",
      entityType: "course",
      entityId: courseId,
      diff: { title: fields.title }
    });

    return { success: true };
  });

export const getAdminAuditLogs = createServerFn({ method: "GET" })
  .handler(async () => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    return sql`
      SELECT a.id, a.action, a.entity_type, a.created_at, p.full_name as actor_name
      FROM audit_log a
      LEFT JOIN profiles p ON a.actor_id = p.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `;
  });

export const getAdminCommodities = createServerFn({ method: "GET" })
  .handler(async () => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // Pull all commodities and their price board entries
    const rows = await sql`
      SELECT
        co.id as commodity_id,
        co.name,
        co.unit,
        cpb.id as price_id,
        cpb.region,
        cpb.price::float as price,
        cpb.source,
        cpb.recorded_at::text as recorded_at
      FROM commodities co
      LEFT JOIN commodity_price_board cpb ON cpb.commodity_id = co.id
      ORDER BY co.name ASC, cpb.recorded_at DESC
    `;

    // Group by commodity id
    const map: Record<string, any> = {};
    for (const row of rows) {
      if (!map[row.commodity_id]) {
        map[row.commodity_id] = {
          id: row.commodity_id,
          name: row.name,
          unit: row.unit,
          entries: [],
        };
      }
      if (row.price_id) {
        map[row.commodity_id].entries.push({
          id: row.price_id,
          region: row.region,
          price: row.price,
          source: row.source || "",
          recorded_at: row.recorded_at || "",
        });
      }
    }

    return Object.values(map);
  });

export const createAdminCommodity = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    unit: z.string().min(1, "Unit is required"),
    region: z.string().optional(),
    price: z.number().min(0).optional(),
    source: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // Insert commodity
    const [commodity] = await sql`
      INSERT INTO commodities (name, unit)
      VALUES (${data.name}, ${data.unit})
      RETURNING id, name, unit
    `;

    // If initial price data is provided, insert it
    if (data.region && data.price !== undefined && data.price >= 0) {
      await sql`
        INSERT INTO commodity_price_board (commodity_id, region, price, source)
        VALUES (${commodity.id}, ${data.region}, ${data.price}, ${data.source || null})
      `;
    }

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "commodity.created",
      entityType: "commodity",
      entityId: commodity.id,
      diff: { name: commodity.name, unit: commodity.unit }
    });

    return { success: true, id: commodity.id };
  });

export const addCommodityPrice = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    commodityId: z.string().uuid(),
    region: z.string().min(2, "Region is required"),
    price: z.number().min(0, "Price must be positive"),
    source: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const [priceEntry] = await sql`
      INSERT INTO commodity_price_board (commodity_id, region, price, source)
      VALUES (${data.commodityId}, ${data.region}, ${data.price}, ${data.source || null})
      RETURNING id, commodity_id, region, price, source
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "commodity.price_added",
      entityType: "commodity_price",
      entityId: priceEntry.id,
      diff: { region: priceEntry.region, price: priceEntry.price }
    });

    return { success: true, id: priceEntry.id };
  });

export const deleteCommodityPrice = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    priceId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const [existing] = await sql`
      SELECT id, commodity_id, region, price FROM commodity_price_board WHERE id = ${data.priceId}
    `;
    if (!existing) throw new Error("Price entry not found");

    await sql`
      DELETE FROM commodity_price_board
      WHERE id = ${data.priceId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "commodity.price_deleted",
      entityType: "commodity_price",
      entityId: data.priceId,
      diff: { region: existing.region, price: existing.price }
    });

    return { success: true };
  });

export const deleteAdminCommodity = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    commodityId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const [existing] = await sql`
      SELECT id, name FROM commodities WHERE id = ${data.commodityId}
    `;
    if (!existing) throw new Error("Commodity not found");

    await sql`
      DELETE FROM commodities
      WHERE id = ${data.commodityId}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "commodity.deleted",
      entityType: "commodity",
      entityId: data.commodityId,
      diff: { name: existing.name }
    });

    return { success: true };
  });

// Customer Management Server Functions
export const getAdminCustomers = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    page: z.number().int().positive().optional().default(1),
    limit: z.number().int().positive().optional().default(50),
    search: z.string().optional().default(""),
    county: z.string().optional().default("All"),
    farmingType: z.string().optional().default("All"),
    status: z.string().optional().default("All"),
    role: z.string().optional().default("All"),
    sortBy: z.string().optional().default("created_at"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const { page, limit, search, county, farmingType, status, role, sortBy, sortOrder } = data;
    const offset = (page - 1) * limit;

    const allowedSortFields = ["full_name", "created_at", "total_orders", "total_spent"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "created_at";
    const sortDir = sortOrder === "asc" ? "ASC" : "DESC";
    const sortColumn = sortField === "full_name" ? "p.full_name" :
                       sortField === "total_orders" ? "COALESCE(count_orders.total_orders, 0)" :
                       sortField === "total_spent" ? "COALESCE(count_orders.total_spent, 0)" : "p.created_at";

    // Build the dynamic count query
    const [countRes] = await sql.unsafe(`
      SELECT COUNT(*) as count
      FROM profiles p
      WHERE p.deleted_at IS NULL
        AND ($1 = '' OR LOWER(p.full_name) LIKE $2 OR LOWER(p.email) LIKE $2 OR p.phone LIKE $2 OR p.id_number LIKE $2)
        AND ($3 = 'All' OR p.county_region = $3)
        AND ($4 = 'All' OR p.nature_of_agriculture = $4)
        AND ($5 = 'All' OR p.status = $5)
        AND p.role::text IN ('farmer', 'retailer')
        AND ($6 = 'All' OR p.role::text = $6)
    `, [
      search.trim(),
      `%${search.trim().toLowerCase()}%`,
      county,
      farmingType,
      status,
      role === 'All' ? 'All' : role || ''
    ]);
    const total = parseInt(countRes?.count || "0");

    // Fetch details
    const customers = await sql.unsafe(`
      SELECT 
        p.id,
        p.full_name,
        p.email,
        p.phone,
        p.whatsapp_number,
        p.id_number,
        p.county_region,
        p.delivery_address,
        p.nature_of_agriculture,
        p.role,
        p.status,
        p.created_at,
        p.last_login_at,
        COALESCE(count_orders.total_orders, 0) as total_orders,
        COALESCE(count_orders.total_spent, 0) as total_spent
      FROM profiles p
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(o.id) as total_orders,
          SUM(o.total) as total_spent
        FROM orders o
        WHERE o.user_id = p.id AND o.deleted_at IS NULL
      ) count_orders ON TRUE
      WHERE p.deleted_at IS NULL
        AND ($1 = '' OR LOWER(p.full_name) LIKE $2 OR LOWER(p.email) LIKE $2 OR p.phone LIKE $2 OR p.id_number LIKE $2)
        AND ($3 = 'All' OR p.county_region = $3)
        AND ($4 = 'All' OR p.nature_of_agriculture = $4)
        AND ($5 = 'All' OR p.status = $5)
        AND p.role::text IN ('farmer', 'retailer')
        AND ($6 = 'All' OR p.role::text = $6)
      ORDER BY ${sortColumn} ${sortDir}
      LIMIT $7 OFFSET $8
    `, [
      search.trim(),
      `%${search.trim().toLowerCase()}%`,
      county,
      farmingType,
      status,
      role === 'All' ? 'All' : role || '',
      limit,
      offset
    ]);

    return {
      customers: customers.map(c => ({
        id: c.id,
        full_name: c.full_name,
        email: c.email,
        phone: c.phone,
        id_number: c.id_number,
        county_region: c.county_region,
        delivery_address: c.delivery_address,
        nature_of_agriculture: c.nature_of_agriculture,
        role: c.role,
        status: c.status,
        total_orders: parseInt(c.total_orders || "0"),
        total_spent: parseFloat(c.total_spent || "0"),
        created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
        last_login_at: c.last_login_at ? new Date(c.last_login_at).toISOString() : null,
        whatsapp_number: c.whatsapp_number || c.phone || "",
      })),
      total,
      page,
      limit
    };
  });

export const getAdminCustomerDetails = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    customerId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    // 1. Fetch customer details
    const [customer] = await sql`
      SELECT 
        p.id,
        p.full_name,
        p.email,
        p.phone,
        p.whatsapp_number,
        p.id_number,
        p.county_region,
        p.delivery_address,
        p.nature_of_agriculture,
        p.role,
        p.status,
        p.avatar_url,
        p.created_at,
        p.last_login_at
      FROM profiles p
      WHERE p.id = ${data.customerId} AND p.deleted_at IS NULL
    `;
    if (!customer) throw new Error("Customer not found");

    // 2. Fetch order count details
    const [orderStats] = await sql`
      SELECT 
        COUNT(id) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status NOT IN ('delivered', 'cancelled') THEN 1 END) as current_orders,
        COALESCE(SUM(total), 0) as total_spent
      FROM orders
      WHERE user_id = ${data.customerId} AND deleted_at IS NULL
    `;

    // 3. Fetch recent orders
    const recentOrders = await sql`
      SELECT id, total, status, created_at
      FROM orders
      WHERE user_id = ${data.customerId} AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // 4. Fetch favorite products (based on ordered quantity)
    const favoriteProducts = await sql`
      SELECT 
        oi.product_name as name,
        SUM(oi.quantity) as count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.user_id = ${data.customerId} AND o.deleted_at IS NULL
      GROUP BY oi.product_name, oi.product_id
      ORDER BY count DESC
      LIMIT 5
    `;

    return {
      customer: {
        ...customer,
        whatsapp_number: customer.whatsapp_number || customer.phone || "",
        created_at: customer.created_at ? new Date(customer.created_at).toISOString() : null,
        last_login_at: customer.last_login_at ? new Date(customer.last_login_at).toISOString() : null,
      },
      stats: {
        totalOrders: parseInt(orderStats?.total_orders || "0"),
        completedOrders: parseInt(orderStats?.completed_orders || "0"),
        currentOrders: parseInt(orderStats?.current_orders || "0"),
        totalSpent: parseFloat(orderStats?.total_spent || "0"),
      },
      recentOrders: recentOrders.map(o => ({
        id: String(o.id).substring(0, 8).toUpperCase(),
        rawId: o.id,
        total: parseFloat(o.total),
        status: o.status,
        date: new Date(o.created_at).toLocaleDateString(),
      })),
      favoriteProducts: favoriteProducts.map(fp => ({
        name: fp.name,
        count: parseInt(fp.count || "0")
      }))
    };
  });

export const updateAdminCustomerStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    customerId: z.string().uuid(),
    status: z.enum(["active", "suspended", "pending"]),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const [existing] = await sql`SELECT status, full_name FROM profiles WHERE id = ${data.customerId}`;
    if (!existing) throw new Error("Customer not found");

    await sql`
      UPDATE profiles
      SET status = ${data.status}, updated_at = NOW()
      WHERE id = ${data.customerId}
    `;

    // Log to audits
    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "customer.status_updated",
      entityType: "profile",
      entityId: data.customerId,
      diff: { from: existing.status, to: data.status, customer: existing.full_name }
    });

    return { success: true };
  });

export const updateAdminCustomerDetails = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    customerId: z.string().uuid(),
    fullName: z.string().min(1),
    phone: z.string().min(1),
    whatsappNumber: z.string().optional(),
    email: z.string().email(),
    idNumber: z.string().min(1),
    countyRegion: z.string().min(1),
    deliveryAddress: z.string().min(1),
    natureOfAgriculture: z.string().min(1),
    status: z.enum(["active", "suspended", "pending"]),
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const [existing] = await sql`SELECT id FROM profiles WHERE id = ${data.customerId}`;
    if (!existing) throw new Error("Customer not found");

    // Perform transaction to keep profiles and users in sync
    await sql.begin(async (sql) => {
      // 1. Update profiles table
      await sql`
        UPDATE profiles
        SET 
          full_name = ${data.fullName},
          phone = ${data.phone},
          whatsapp_number = ${data.whatsappNumber || null},
          email = ${data.email},
          id_number = ${data.idNumber},
          county_region = ${data.countyRegion},
          delivery_address = ${data.deliveryAddress},
          nature_of_agriculture = ${data.natureOfAgriculture},
          status = ${data.status},
          updated_at = NOW()
        WHERE id = ${data.customerId}
      `;

      // 2. Check if user exists in users table and update it too
      const [u] = await sql`SELECT id FROM users WHERE id = ${data.customerId}`;
      if (u) {
        // Split full name back to first/last name
        const names = data.fullName.trim().split(/\s+/);
        const firstName = names[0] || "";
        const lastName = names.slice(1).join(" ") || "";

        await sql`
          UPDATE users
          SET 
            first_name = ${firstName},
            last_name = ${lastName},
            phone_number = ${data.phone},
            email = ${data.email},
            national_id = ${data.idNumber},
            county = ${data.countyRegion},
            delivery_location = ${data.deliveryAddress},
            farming_type = ${data.natureOfAgriculture}
          WHERE id = ${data.customerId}
        `;
      }
    });

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "customer.details_updated",
      entityType: "profile",
      entityId: data.customerId,
      diff: { name: data.fullName }
    });

    return { success: true };
  });

export const deleteAdminCustomer = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    customerId: z.string().uuid()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();
    const { getDb } = await import("../db-functions");
    const sql = getDb();

    if (data.customerId === actor.id) {
      throw new Error("Self-deletion is prohibited: You cannot delete your own admin account.");
    }

    const [existing] = await sql`SELECT full_name FROM profiles WHERE id = ${data.customerId}`;
    if (!existing) throw new Error("Customer not found");

    await sql.begin(async (sql) => {
      await sql`
        UPDATE profiles
        SET deleted_at = NOW()
        WHERE id = ${data.customerId}
      `;
      await sql`
        UPDATE users
        SET password_hash = 'DELETED_' || gen_random_uuid()::text
        WHERE id = ${data.customerId}
      `;
    });

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "customer.deleted",
      entityType: "profile",
      entityId: data.customerId,
      diff: { customer: existing.full_name }
    });

    return { success: true };
  });

// Helper for relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Server function: Get contact inquiries
export const getAdminInquiries = createServerFn({ method: "GET" })
  .handler(async () => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const inquiries = await sql`
      SELECT id, name, email, message, created_at
      FROM contact_submissions
      ORDER BY created_at DESC
    `;

    return inquiries.map(inq => {
      const msg = inq.message || "";
      let subject = "No Subject";
      let userType = "Farmer";
      let phone = "N/A";
      let cleanMessage = msg;

      const subjectMatch = msg.match(/^Subject:\s*(.*)$/m);
      const userTypeMatch = msg.match(/^User Type:\s*(.*)$/m);
      const phoneMatch = msg.match(/^Phone:\s*(.*)$/m);
      const messageBodyMatch = msg.split(/\n\nMessage:\n/);

      if (subjectMatch) subject = subjectMatch[1].trim();
      if (userTypeMatch) userType = userTypeMatch[1].trim();
      if (phoneMatch) phone = phoneMatch[1].trim();
      if (messageBodyMatch.length > 1) {
        cleanMessage = messageBodyMatch.slice(1).join("\n\n").trim();
      }

      return {
        id: inq.id,
        name: inq.name,
        email: inq.email,
        phone,
        userType,
        subject,
        message: cleanMessage,
        rawMessage: msg,
        createdAt: inq.created_at,
        time: formatRelativeTime(new Date(inq.created_at)),
        date: new Date(inq.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };
    });
  });

// Server function: Delete contact inquiry
export const deleteAdminInquiry = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string()
  }))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("../auth-admin-helper-functions");
    const actor = await verifyAdminSession();

    const { getDb } = await import("../db-functions");
    const sql = getDb();

    const [existing] = await sql`SELECT id, name FROM contact_submissions WHERE id = ${data.id}`;
    if (!existing) throw new Error("Inquiry not found");

    await sql`
      DELETE FROM contact_submissions
      WHERE id = ${data.id}
    `;

    const { writeAuditLog } = await import("../audit-functions");
    await writeAuditLog({
      actorId: actor.id,
      action: "inquiry.deleted",
      entityType: "contact_submission",
      entityId: data.id,
      diff: { name: existing.name }
    });

    return { success: true };
  });

