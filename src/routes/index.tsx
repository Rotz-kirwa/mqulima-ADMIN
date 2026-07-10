import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AcademyBuilder } from "@/components/AcademyBuilder";
import { MarketsBuilder } from "@/components/MarketsBuilder";
import { CustomerManager } from "@/components/CustomerManager";
import {
  LayoutDashboard, ShoppingCart, Package, Briefcase, FileText,
  Users, MessageSquare, Settings, GraduationCap, ChevronLeft,
  ChevronRight, Bell, Search, Lock, DollarSign,
  ShoppingBag, AlertCircle, Activity, LogOut, RefreshCw,
  CheckCircle2, TrendingUp, Plus, Trash2, Edit, X, Upload, Star, Eye,
  MessageCircle, CheckCheck, Inbox, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  getAdminDashboardData,
  getAdminOrders,
  getAdminServiceRequests,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  updateOrderStatus,
  updateServiceRequestStatus,
  getMainAppUrl,
  getAdminUsers,
  createAdminUser,
  updateUserRole,
  deleteUser,
  getAdminContent,
  toggleContentStatus,
  deleteContent,
  getAdminForum,
  deleteForumPost,
  getAdminAuditLogs,
  createAdminBlogPost,
  getAdminBlogAuthors,
  updateAdminBlogPost,
  getAdminInquiries,
  deleteAdminInquiry
} from "@/lib/api/admin.functions";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { getAdminCurrentUser } = await import("@/lib/auth-admin");
    const currentUser = await getAdminCurrentUser();
    if (!currentUser || !["super_admin", "admin"].includes(currentUser.role)) {
      throw redirect({ to: "/login" });
    }
    return { adminUser: currentUser };
  },
  head: () => ({
    meta: [
      { title: "Mqulima Admin Console" },
      { name: "description", content: "Mqulima platform administration dashboard" },
    ],
  }),
  component: AdminPanel,
});

// Icon mapping for KPIs
const iconMap: Record<string, any> = {
  DollarSign,
  ShoppingBag,
  AlertCircle,
  Activity,
  MessageSquare,
  Users,
};

const AGRICULTURE_CATEGORIES = [
  "Seeds & Seedlings",
  "Crop Protection",
  "Fertilizers",
  "Plant Growth & Boosters",
  "Harvest & Storage",
  "Animal Farming",
  "Farm Equipment",
  "Water & Sanitation"
];

function AdminPanel() {
  const navigate = useNavigate();
  const { adminUser } = Route.useRouteContext();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Data states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [contentList, setContentList] = useState<any[]>([]);
  const [forumList, setForumList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [blogAuthors, setBlogAuthors] = useState<any[]>([]);

  // Inquiries State
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [inquirySearch, setInquirySearch] = useState("");
  const [readInquiryIds, setReadInquiryIds] = useState<string[]>([]);
  const [resolvedInquiryIds, setResolvedInquiryIds] = useState<string[]>([]);
  const [inquiryFilter, setInquiryFilter] = useState<"all" | "unread" | "resolved">("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRead = localStorage.getItem("read_inquiries");
      if (savedRead) {
        try { setReadInquiryIds(JSON.parse(savedRead)); } catch (e) {}
      }
      const savedResolved = localStorage.getItem("resolved_inquiries");
      if (savedResolved) {
        try { setResolvedInquiryIds(JSON.parse(savedResolved)); } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (selectedInquiry && !readInquiryIds.includes(selectedInquiry.id)) {
      const updated = [...readInquiryIds, selectedInquiry.id];
      setReadInquiryIds(updated);
      localStorage.setItem("read_inquiries", JSON.stringify(updated));
    }
  }, [selectedInquiry]);

  const handleToggleResolveInquiry = (id: string) => {
    let updated;
    if (resolvedInquiryIds.includes(id)) {
      updated = resolvedInquiryIds.filter(x => x !== id);
      toast.success("Inquiry marked as active");
    } else {
      updated = [...resolvedInquiryIds, id];
      toast.success("Inquiry marked as resolved");
    }
    setResolvedInquiryIds(updated);
    localStorage.setItem("resolved_inquiries", JSON.stringify(updated));
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this inquiry?")) return;
    try {
      await deleteAdminInquiry({ data: { id } });
      toast.success("Inquiry deleted successfully");
      setInquiries(prev => prev.filter(x => x.id !== id));
      if (selectedInquiry?.id === id) {
        setSelectedInquiry(null);
      }
      setRefreshKey(prev => prev + 1);
    } catch (e) {
      toast.error("Failed to delete inquiry");
    }
  };

  // Create Admin Modal State
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false);
  const [adminFormEmail, setAdminFormEmail] = useState("");
  const [adminFormFullName, setAdminFormFullName] = useState("");
  const [adminFormPassword, setAdminFormPassword] = useState("");
  const [adminFormRole, setAdminFormRole] = useState<'super_admin' | 'admin' | 'sales_agent' | 'content_editor'>("admin");
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Create Blog Post Modal State
  const [isPostCreateOpen, setIsPostCreateOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postCategory, setPostCategory] = useState("Farm Tips");
  const [postExcerpt, setPostExcerpt] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postCoverImage, setPostCoverImage] = useState("");
  const [postAuthorId, setPostAuthorId] = useState("");
  const [postStatus, setPostStatus] = useState<"draft" | "published">("published");
  const [savingPost, setSavingPost] = useState(false);

  // Edit Blog Post Modal State
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostCategory, setEditPostCategory] = useState("Farm Tips");
  const [editPostExcerpt, setEditPostExcerpt] = useState("");
  const [editPostBody, setEditPostBody] = useState("");
  const [editPostCoverImage, setEditPostCoverImage] = useState("");
  const [editPostAuthorId, setEditPostAuthorId] = useState("");
  const [editPostStatus, setEditPostStatus] = useState<"draft" | "published">("published");
  const [savingEditPost, setSavingEditPost] = useState(false);

  const openEditPost = (post: any) => {
    setEditingPost(post);
    setEditPostTitle(post.title || "");
    setEditPostCategory(post.category || "Farm Tips");
    setEditPostExcerpt(post.excerpt || "");
    setEditPostBody(post.body || "");
    setEditPostCoverImage(post.cover_image || "");
    setEditPostAuthorId(post.author_id || (blogAuthors.length > 0 ? blogAuthors[0].id : ""));
    setEditPostStatus(post.status === "published" ? "published" : "draft");
  };

  // Products management local search and filters
  const [adminSearch, setAdminSearch] = useState("");
  const [adminCategoryFilter, setAdminCategoryFilter] = useState("All");
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFeaturedFormMode, setIsFeaturedFormMode] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Form Fields State
  const [formName, setFormName] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formOriginalPrice, setFormOriginalPrice] = useState<number | "">("");
  const [formStock, setFormStock] = useState(9999);
  const [formImage, setFormImage] = useState("");
  const [formRating, setFormRating] = useState(0);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBriefDescription, setFormBriefDescription] = useState("");
  const [formUnit, setFormUnit] = useState("/unit");
  const [formBadge, setFormBadge] = useState("");
  const [formCategory, setFormCategory] = useState("Seeds & Seedlings");
  const [formSubcategory, setFormSubcategory] = useState("");
  const [formShopType, setFormShopType] = useState("agrovet");
  const [formOrganic, setFormOrganic] = useState(false);
  const [formVerified, setFormVerified] = useState(true);
  const [formIsFeatured, setFormIsFeatured] = useState(false);

  // Fetch all data from local PostgreSQL
  useEffect(() => {
    if (!adminUser) return;
    async function loadData() {
      setLoading(true);
      try {
        const [dash, ord, serv, prod, usrs, cnt, frm, aud, authors, inqs] = await Promise.all([
          getAdminDashboardData(),
          getAdminOrders(),
          getAdminServiceRequests(),
          getAdminProducts(),
          getAdminUsers(),
          getAdminContent(),
          getAdminForum(),
          getAdminAuditLogs(),
          getAdminBlogAuthors(),
          getAdminInquiries(),
        ]);
        setDashboardData(dash);
        setOrders(Array.isArray(ord) ? ord : (ord as any).orders || []);
        setServiceRequests(serv);
        setProducts(prod || []);
        setUsersList(usrs || []);
        setContentList(cnt || []);
        setForumList(frm || []);
        setAuditLogs(aud || []);
        const authorsArr = Array.isArray(authors) ? authors : [];
        setBlogAuthors(authorsArr);
        if (authorsArr.length > 0) setPostAuthorId(authorsArr[0].id);
        
        const sortedInquiries = inqs || [];
        setInquiries(sortedInquiries);
        if (sortedInquiries.length > 0) {
          setSelectedInquiry(sortedInquiries[0]);
        }
      } catch (error) {
        console.error("Failed to load admin data:", error);
        toast.error("Error loading live data from database");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [refreshKey, adminUser]);

  // Product management actions
  const resetForm = () => {
    setFormName("");
    setFormBrand("");
    setFormPrice(0);
    setFormOriginalPrice("");
    setFormStock(9999);
    setFormImage("");
    setFormRating(0);
    setFormImages([]);
    setFormDescription("");
    setFormBriefDescription("");
    setFormCategory("Seeds & Seedlings");
    setFormSubcategory("");
    setFormShopType("agrovet");
    setFormUnit("/unit");
    setFormBadge("");
    setFormOrganic(false);
    setFormVerified(true);
    setFormIsFeatured(false);
    setIsFeaturedFormMode(false);
    setEditingProduct(null);
  };

  const handleEditClick = (p: any) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormBrand(p.brand || "");
    setFormPrice(p.price);
    setFormOriginalPrice(p.originalPrice || "");
    setFormStock(p.stock);
    setFormImage(p.image);
    setFormRating(p.rating || 0);
    setFormImages(p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : [p.image]);
    setFormDescription(p.description || "");
    setFormBriefDescription(p.briefDescription || "");
    setFormCategory(p.category);
    setFormSubcategory(p.subcategory || "");
    setFormShopType(p.shopType || "agrovet");
    setFormUnit(p.unit || "/unit");
    setFormBadge(p.badge || "");
    setFormOrganic(!!p.organic);
    setFormVerified(!!p.verifiedSeller);
    setFormIsFeatured(!!p.isFeatured);
    setIsCreateOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || formPrice <= 0) {
      toast.error("Please provide a valid product name and price.");
      return;
    }

    try {
      const { getCsrfTokenFromCookie } = await import("@/lib/csrf-client");
      const csrfToken = getCsrfTokenFromCookie() || "mock-csrf-token";

      if (editingProduct) {
        await updateAdminProduct({
          data: {
            id: editingProduct.id,
            name: formName,
            brand: formBrand,
            price: formPrice,
            originalPrice: formOriginalPrice === "" ? null : Number(formOriginalPrice),
            stock: formStock,
            image: formImage || "/placeholder-product.png",
            images: formImages.length > 0 ? formImages : [formImage || "/placeholder-product.png"],
            description: formDescription,
            briefDescription: formBriefDescription,
            badge: formBadge,
            organic: formOrganic,
            verifiedSeller: formVerified,
            shopType: formShopType as any,
            unit: formUnit,
            category: formCategory,
            subcategory: formSubcategory,
            rating: formRating,
            isFeatured: formIsFeatured,
            csrfToken
          }
        });
        toast.success("Product updated successfully!");
      } else {
        await createAdminProduct({
          data: {
            name: formName,
            brand: formBrand,
            price: formPrice,
            originalPrice: formOriginalPrice === "" ? null : Number(formOriginalPrice),
            stock: formStock,
            image: formImage || "/placeholder-product.png",
            images: formImages.length > 0 ? formImages : [formImage || "/placeholder-product.png"],
            description: formDescription,
            briefDescription: formBriefDescription,
            badge: formBadge,
            organic: formOrganic,
            verifiedSeller: formVerified,
            shopType: formShopType as any,
            unit: formUnit,
            category: formCategory,
            subcategory: formSubcategory,
            rating: formRating,
            isFeatured: formIsFeatured,
            csrfToken
          }
        });
        toast.success("Product created successfully!");
      }

      setIsCreateOpen(false);
      resetForm();
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to save product.");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      const { getCsrfTokenFromCookie } = await import("@/lib/csrf-client");
      const csrfToken = getCsrfTokenFromCookie() || "mock-csrf-token";

      await deleteAdminProduct({ data: { id: productId, csrfToken } });
      toast.success("Product deleted successfully!");
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product.");
    }
  };

  const handleQuickStockUpdate = async (productId: string, newStock: number) => {
    if (newStock < 0) return;

    try {
      const { getCsrfTokenFromCookie } = await import("@/lib/csrf-client");
      const csrfToken = getCsrfTokenFromCookie() || "mock-csrf-token";

      await updateAdminProduct({
        data: {
          id: productId,
          stock: newStock,
          csrfToken
        }
      });
      toast.success("Stock level updated!");
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to update stock.");
    }
  };

  const handleToggleFeatured = async (productId: string, currentFeatured: boolean) => {
    try {
      const { getCsrfTokenFromCookie } = await import("@/lib/csrf-client");
      const csrfToken = getCsrfTokenFromCookie() || "mock-csrf-token";

      await updateAdminProduct({
        data: {
          id: productId,
          isFeatured: !currentFeatured,
          csrfToken
        }
      });
      toast.success(currentFeatured ? "Removed from Featured Collection" : "Added to Featured Collection!");
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to update featured status.");
    }
  };

  // Handle User actions
  const handleCreateAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdmin(true);
    try {
      await createAdminUser({
        data: {
          email: adminFormEmail,
          fullName: adminFormFullName,
          password: adminFormPassword,
          role: adminFormRole
        }
      });
      toast.success("Administrator account created successfully!");
      setIsAdminCreateOpen(false);
      setAdminFormEmail("");
      setAdminFormFullName("");
      setAdminFormPassword("");
      setAdminFormRole("admin");
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to create administrator account.");
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    try {
      await updateUserRole({ data: { userId, role: role as any } });
      toast.success("User role updated successfully");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error("Failed to update user role");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to soft delete this user?")) return;
    try {
      await deleteUser({ data: { userId } });
      toast.success("User deleted successfully");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  // Handle Content actions
  const handleToggleContentStatus = async (postId: string) => {
    try {
      await toggleContentStatus({ data: { postId } });
      toast.success("Content status updated");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteContent = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;
    try {
      await deleteContent({ data: { postId } });
      toast.success("Article deleted");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error("Failed to delete article");
    }
  };

  // Handle Forum actions
  const handleDeleteForumPost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteForumPost({ data: { postId } });
      toast.success("Forum post deleted");
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error("Failed to delete forum post");
    }
  };

  // Handle Order status update
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { getCsrfTokenFromCookie } = await import("../lib/csrf-client");
      await updateOrderStatus({ data: { orderId, status: status as any, csrfToken: getCsrfTokenFromCookie() } });
      toast.success(`Order status updated to ${status}`);
      setRefreshKey(prev => prev + 1);
      setSelectedOrder((prev: any) => prev && prev.rawId === orderId ? { ...prev, status } : prev);
    } catch (error) {
      toast.error("Failed to update order status");
    }
  };

  // Handle Order payment status update
  const handleUpdatePaymentStatus = async (orderId: string, paymentStatus: string) => {
    try {
      const { getCsrfTokenFromCookie } = await import("../lib/csrf-client");
      await updateOrderStatus({ data: { orderId, paymentStatus: paymentStatus as any, csrfToken: getCsrfTokenFromCookie() } });
      toast.success(`Payment status updated to ${paymentStatus}`);
      setRefreshKey(prev => prev + 1);
      setSelectedOrder((prev: any) => prev && prev.rawId === orderId ? { ...prev, payment: paymentStatus } : prev);
    } catch (error) {
      toast.error("Failed to update payment status");
    }
  };

  // Handle Service Request status update
  const handleUpdateServiceStatus = async (requestId: string, status: string) => {
    try {
      const { getCsrfTokenFromCookie } = await import("../lib/csrf-client");
      await updateServiceRequestStatus({ data: { requestId, status: status as any, csrfToken: getCsrfTokenFromCookie() } });
      toast.success(`Service request status updated to ${status}`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error("Failed to update service request status");
    }
  };

  if (!adminUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#F7F7F5]">
        <RefreshCw className="h-8 w-8 text-[#2D6A4F] animate-spin" />
        <span className="text-xs text-gray-400 mt-2 font-mono">Verifying admin session...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F7F7F5] overflow-hidden w-full" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* SIDEBAR */}
      <aside className={`${sidebarCollapsed ? "w-[68px]" : "w-[260px]"} bg-[#0A0F0D] border-r border-[#2D6A4F]/30 flex flex-col justify-between transition-all duration-300 shrink-0`}>
        <div>
          {/* Logo */}
          <div className="px-4 py-5 border-b border-[#2D6A4F]/20 flex items-center gap-3">
            <div className="h-9 w-9 bg-[#2D6A4F] flex items-center justify-center border border-[#F5A623] text-white font-bold text-lg shrink-0">M</div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-xs font-extrabold tracking-widest uppercase text-[#F5A623]">Admin Console</h1>
                <span className="text-[9px] text-white/40 font-mono block truncate" title={adminUser.email}>{adminUser.email} ({adminUser.role})</span>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="p-3 space-y-1">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "customers", label: "Customers", icon: Users },
              { id: "inquiries", label: "Inquiries", icon: MessageCircle },
              { id: "orders", label: "Orders & Quotations", icon: ShoppingCart },
              { id: "products", label: "Products & Stock", icon: Package },
              { id: "featured", label: "Featured Collection", icon: Star },
              { id: "services", label: "Service Requests", icon: Briefcase },
              { id: "content", label: "Content (News)", icon: FileText },
              { id: "forum", label: "Forum Moderation", icon: MessageSquare },
              { id: "users", label: "Admin Roles", icon: Lock },
              { id: "academy", label: "Academy", icon: GraduationCap },
              { id: "markets", label: "Market Prices", icon: TrendingUp },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-[#2D6A4F] text-white shadow-md"
                      : "text-white/60 hover:bg-[#2D6A4F]/20 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {item.id === "orders" && !sidebarCollapsed && orders.filter(o => o.status === "pending").length > 0 && (
                    <span className="ml-auto bg-[#F5A623] text-[#0A0F0D] text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {orders.filter(o => o.status === "pending").length}
                    </span>
                  )}
                  {item.id === "inquiries" && !sidebarCollapsed && inquiries.filter(inq => !readInquiryIds.includes(inq.id)).length > 0 && (
                    <span className="ml-auto bg-amber-400 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {inquiries.filter(inq => !readInquiryIds.includes(inq.id)).length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-[#2D6A4F]/20 space-y-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] text-white/40 hover:text-white transition rounded-lg hover:bg-[#2D6A4F]/20 cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
          </button>
          <button
            onClick={async () => {
              if (typeof window !== "undefined") {
                try {
                  const url = await getMainAppUrl();
                  window.location.href = url;
                } catch (err) {
                  window.location.href = window.location.origin.replace("8081", "8080");
                }
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] text-white/40 hover:text-[#F5A623] transition rounded-lg hover:bg-[#2D6A4F]/10 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            {!sidebarCollapsed && <span>Exit to Main Site</span>}
          </button>
          <button
            onClick={async () => {
              try {
                const { logoutAdmin } = await import("@/lib/auth-admin");
                await logoutAdmin();
                navigate({ to: "/login", replace: true });
              } catch (e) {
                toast.error("Failed to log out");
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] text-white/40 hover:text-red-500 transition rounded-lg hover:bg-red-500/10 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            {!sidebarCollapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <Lock className="h-3.5 w-3.5 text-[#F5A623]" />
            <span className="text-[10px] font-mono text-gray-400">admin.mqulima.com/{activeSection}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh database data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#2D6A4F]" : ""}`} />
              {!loading && <span className="text-[10px] text-gray-400">Sync</span>}
            </button>
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders, products, users..."
                className="w-64 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pl-9 text-xs outline-none focus:border-[#2D6A4F] transition"
              />
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-gray-400" />
            </div>
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition cursor-pointer">
              <Bell className="h-4 w-4 text-gray-500" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-[#F5A623] rounded-full" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="h-7 w-7 rounded-lg bg-[#2D6A4F] text-white text-[10px] font-bold flex items-center justify-center">
                {adminUser.name ? adminUser.name.substring(0, 2).toUpperCase() : "AD"}
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-gray-800 block">{adminUser.name || "Admin"}</span>
                <span className="text-[9px] text-gray-400 block">{adminUser.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading && !dashboardData ? (
            <div className="flex flex-col items-center justify-center h-full py-24">
              <RefreshCw className="h-8 w-8 text-[#2D6A4F] animate-spin" />
              <span className="text-xs text-gray-400 mt-2 font-mono">Querying PostgreSQL database...</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {/* DASHBOARD */}
                {activeSection === "dashboard" && dashboardData && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Dashboard</h2>
                        <p className="text-xs text-gray-500 mt-1">Platform overview — real-time KPIs from PostgreSQL database</p>
                      </div>
                      <div className="text-xs font-semibold text-gray-400 bg-white border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                        Live DB Connected
                      </div>
                    </div>

                    {/* KPI Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {dashboardData.kpis.map((kpi: any, i: number) => {
                        const Icon = iconMap[kpi.icon] || DollarSign;
                        return (
                          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{kpi.label}</span>
                              <div className="h-8 w-8 rounded-lg bg-[#2D6A4F]/10 flex items-center justify-center">
                                <Icon className="h-4 w-4 text-[#2D6A4F]" />
                              </div>
                            </div>
                            <div className="mt-3 flex items-end justify-between">
                              <span className="text-2xl font-extrabold text-gray-900">{kpi.value}</span>
                              <span className={`text-xs font-bold ${kpi.positive ? "text-emerald-600" : "text-amber-600"}`}>
                                {kpi.change}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Recent Orders + Service Requests side-by-side */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Recent Orders */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-xs">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-900">Recent Orders</h3>
                          <button onClick={() => setActiveSection("orders")} className="text-[10px] font-bold text-[#2D6A4F] hover:underline cursor-pointer">View All →</button>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {dashboardData.recentOrders.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-xs">No orders in database yet</div>
                          ) : (
                            dashboardData.recentOrders.map((order: any) => (
                              <div key={order.id} className="px-5 py-3 flex items-center justify-between text-xs hover:bg-gray-50/50 transition">
                                <div>
                                  <span className="font-bold text-[#2D6A4F]">{order.id}</span>
                                  <span className="text-gray-600 ml-2 font-semibold">{order.customer}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-gray-900">{order.total}</span>
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    order.status === "paid" || order.status === "delivered" ? "bg-emerald-50 text-emerald-700" :
                                    order.status === "pending" ? "bg-amber-50 text-amber-700" :
                                    order.status === "cancelled" ? "bg-red-50 text-red-700" :
                                    "bg-purple-50 text-purple-700"
                                  }`}>{order.status}</span>
                                  <span className="text-gray-400">{order.time}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Service Requests */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-xs">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-900">Service Requests</h3>
                          <button onClick={() => setActiveSection("services")} className="text-[10px] font-bold text-[#2D6A4F] hover:underline cursor-pointer">View Kanban →</button>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {dashboardData.recentServiceRequests.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-xs">No service requests in database yet</div>
                          ) : (
                            dashboardData.recentServiceRequests.map((req: any) => (
                              <div key={req.id} className="px-5 py-3 flex items-center justify-between text-xs hover:bg-gray-50/50 transition">
                                <div>
                                  <span className="font-bold text-gray-800">{req.service}</span>
                                  <span className="text-gray-400 ml-2">{req.farmer} — {req.county}</span>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  req.status === "requested" ? "bg-amber-50 text-amber-700" :
                                  req.status === "assigned" ? "bg-blue-50 text-blue-700" :
                                  req.status === "in_progress" ? "bg-purple-50 text-purple-700" :
                                  "bg-emerald-50 text-emerald-700"
                                }`}>{req.status}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ORDERS */}
                {activeSection === "orders" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Orders & Quotations</h2>
                        <p className="text-xs text-gray-500 mt-1">Manage customer orders, quotation requests, and payment status</p>
                      </div>
                    </div>

                    {/* Orders table */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            {["Order ID", "Customer", "Items", "Total", "Payment Status", "Order Status", "Channel", "Date", "Action"].map(h => (
                              <th key={h} className="px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {orders.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-gray-400 text-xs">No orders found in database</td>
                            </tr>
                          ) : (
                            orders.map(order => (
                              <tr key={order.id} className="hover:bg-gray-50/50 transition">
                                <td className="px-4 py-3 font-bold text-[#2D6A4F]">
                                  <button
                                    onClick={() => setSelectedOrder(order)}
                                    className="hover:underline font-extrabold cursor-pointer text-left focus:outline-none"
                                  >
                                    {order.id}
                                  </button>
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-800">{order.customer}</td>
                                <td className="px-4 py-3 text-gray-500">{order.items} items</td>
                                <td className="px-4 py-3 font-bold text-gray-900">{order.total}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    order.payment === "paid" ? "bg-emerald-50 text-emerald-700" :
                                    order.payment === "pending" ? "bg-amber-50 text-amber-700" :
                                    "bg-red-50 text-red-700"
                                  }`}>{order.payment}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={order.status}
                                    onChange={(e) => handleUpdateOrderStatus(order.rawId, e.target.value)}
                                    className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[10px] font-semibold text-gray-700 outline-none cursor-pointer"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="processing">Processing</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                </td>
                                <td className="px-4 py-3 text-gray-500 capitalize">{order.channel}</td>
                                <td className="px-4 py-3 text-gray-400">{order.date}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setSelectedOrder(order)}
                                      className="p-1 hover:bg-[#2D6A4F]/10 hover:text-[#2D6A4F] text-gray-500 rounded transition cursor-pointer"
                                      title="View Details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleUpdateOrderStatus(order.rawId, "delivered")}
                                      className="p-1 hover:bg-[#2D6A4F]/10 hover:text-[#2D6A4F] text-gray-500 rounded transition cursor-pointer"
                                      title="Quick Complete"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* FEATURED PRODUCTS SECTION */}
                {activeSection === "featured" && (
                  <div className="space-y-6 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Featured Collection</h2>
                        <p className="text-xs text-gray-500 mt-1">Control which premium products are prominently displayed in the home page showcase.</p>
                      </div>
                      <button
                        onClick={() => {
                          resetForm();
                          setFormIsFeatured(true);
                          setIsFeaturedFormMode(true);
                          setFormPrice(1);
                          setFormStock(9999);
                          setIsCreateOpen(true);
                        }}
                        className="bg-[#2D6A4F] hover:bg-[#1A5438] text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-lg shadow transition flex items-center gap-2 cursor-pointer self-start"
                      >
                        <Plus className="h-4 w-4" /> Add Product
                      </button>
                    </div>

                    {/* KPI Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:shadow-md transition flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Featured items</span>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-3xl font-extrabold text-amber-500">{products.filter(p => p.isFeatured).length}</span>
                            <span className="text-[10px] text-gray-400 font-semibold">on homepage</span>
                          </div>
                        </div>
                        <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:shadow-md transition flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total catalog</span>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-3xl font-extrabold text-gray-900">{products.length}</span>
                            <span className="text-[10px] text-gray-400 font-semibold">products</span>
                          </div>
                        </div>
                        <div className="h-10 w-10 bg-[#2D6A4F]/10 rounded-xl flex items-center justify-center">
                          <Package className="h-5 w-5 text-[#2D6A4F]" />
                        </div>
                      </div>

                      <div className="bg-[#2D6A4F]/5 border border-[#2D6A4F]/20 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D6A4F]">Tip for Admins</span>
                        <p className="text-xs text-gray-600 mt-2">
                          Keep the featured list under 8-12 products to give customers a curated, premium browsing experience.
                        </p>
                      </div>
                    </div>

                    {/* Filter controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-gray-200 p-4 rounded-xl shadow-xs">
                      <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search products to feature..."
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs outline-none focus:border-[#2D6A4F] text-gray-800"
                        />
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Category:</span>
                          <select
                            value={adminCategoryFilter}
                            onChange={(e) => setAdminCategoryFilter(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-700 outline-none font-bold cursor-pointer"
                          >
                            <option value="All">All Categories</option>
                            {AGRICULTURE_CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Products Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {products.filter(p => {
                        const matchesSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
                                              (p.brand || "").toLowerCase().includes(adminSearch.toLowerCase());
                        const matchesCategory = adminCategoryFilter === "All" || p.category === adminCategoryFilter;
                        return matchesSearch && matchesCategory;
                      }).length === 0 ? (
                        <div className="col-span-full bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 font-medium">
                          No matching products found.
                        </div>
                      ) : (
                        products.filter(p => {
                          const matchesSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
                                                (p.brand || "").toLowerCase().includes(adminSearch.toLowerCase());
                          const matchesCategory = adminCategoryFilter === "All" || p.category === adminCategoryFilter;
                          return matchesSearch && matchesCategory;
                        }).map(p => {
                          return (
                            <div 
                              key={p.id} 
                              className={`bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between ${
                                p.isFeatured ? "border-amber-300 ring-2 ring-amber-300/20" : "border-gray-200"
                              }`}
                            >
                              <div className="relative aspect-video bg-gray-50 border-b border-gray-150 flex items-center justify-center p-3">
                                <img 
                                  src={p.image} 
                                  alt={p.name} 
                                  className="h-full w-full object-contain" 
                                  onError={e => {e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder-product.png";}} 
                                />
                                {p.isFeatured && (
                                  <div className="absolute top-2 right-2 bg-amber-500 text-amber-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                    <Star className="h-3 w-3 fill-amber-950" /> Featured
                                  </div>
                                )}
                              </div>
                              <div className="p-4 flex-1 flex flex-col justify-between">
                                <div className="text-left">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{p.category}</span>
                                  <h4 className="font-extrabold text-sm text-gray-900 mt-1 line-clamp-2 min-h-[40px]">{p.name}</h4>
                                  <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{p.brand || "Generic"}</p>
                                </div>
                                <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-100">
                                  <div className="text-left">
                                    <span className="text-[9px] text-gray-400 block uppercase font-bold">Price</span>
                                    <span className="text-sm font-black text-[#2D6A4F]">KES {p.price.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        handleEditClick(p);
                                        setIsFeaturedFormMode(true);
                                      }}
                                      className="p-1.5 border border-gray-200 hover:border-[#2D6A4F] text-gray-500 hover:text-[#2D6A4F] rounded-lg transition cursor-pointer"
                                      title="Edit Product"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(p.id)}
                                      className="p-1.5 border border-gray-200 hover:border-red-500 text-gray-500 hover:text-red-500 rounded-lg transition cursor-pointer"
                                      title="Delete SKU"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleFeatured(p.id, !!p.isFeatured)}
                                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1 ${
                                        p.isFeatured
                                          ? "bg-amber-500 hover:bg-amber-600 text-amber-950"
                                          : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                                      }`}
                                    >
                                      <Star className={`h-3 w-3 ${p.isFeatured ? "fill-amber-950" : ""}`} />
                                      {p.isFeatured ? "Featured" : "Feature"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* PRODUCTS & STOCK */}
                {activeSection === "products" && (
                  <div className="space-y-6 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Products & Inventory</h2>
                        <p className="text-xs text-gray-500 mt-1">Add products, edit stock, price, taxonomy and category details</p>
                      </div>
                      <button
                        onClick={() => {
                          resetForm();
                          setIsCreateOpen(true);
                        }}
                        className="bg-[#2D6A4F] hover:bg-[#1A5438] text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-lg shadow transition flex items-center gap-2 cursor-pointer self-start"
                      >
                        <Plus className="h-4 w-4" /> Add Product
                      </button>
                    </div>

                    {/* KPI Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Catalog</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-gray-900">{products.length}</span>
                          <span className="text-[10px] text-gray-400 font-medium">SKUs</span>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Inventory Value</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-xl font-bold text-gray-900">
                            KSh {products.reduce((sum, p) => sum + (p.price * p.stock), 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-700/80">Out of Stock</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-red-600">
                            {products.filter(p => p.stock === 0).length}
                          </span>
                          <span className="text-[10px] text-red-500 font-semibold">items</span>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80">Low Stock</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold text-amber-600">
                            {products.filter(p => p.stock > 0 && p.stock <= 5).length}
                          </span>
                          <span className="text-[10px] text-amber-500 font-semibold">{"<= 5"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Low Stock Banner alerts */}
                    {products.some(p => p.stock <= 5) && (
                      <div className="border border-amber-200 bg-amber-50/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Critical Inventory Restock Alerts</h3>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {products.filter(p => p.stock <= 5).map(p => (
                            <div key={p.id} className="bg-white border border-amber-100 p-3 rounded-lg flex items-center justify-between gap-3 shadow-sm">
                              <div className="min-w-0 flex-1 text-left">
                                <div className="text-xs font-bold text-gray-800 truncate">{p.name}</div>
                                <div className="text-[10px] mt-0.5 font-medium text-amber-600">Stock: {p.stock} left</div>
                              </div>
                              <button
                                onClick={() => handleQuickStockUpdate(p.id, p.stock + 50)}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[9px] uppercase tracking-wider py-1.5 px-2.5 rounded transition shrink-0 cursor-pointer"
                              >
                                + Restock (50)
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Filters Row */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                      <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search products..."
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs outline-none focus:border-[#2D6A4F] text-gray-800"
                        />
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <span className="text-[10px] text-gray-450 font-bold uppercase tracking-wider">Category:</span>
                        <select
                          value={adminCategoryFilter}
                          onChange={(e) => setAdminCategoryFilter(e.target.value)}
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-700 outline-none font-bold cursor-pointer"
                        >
                          <option value="All">All Categories</option>
                          {AGRICULTURE_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                          <thead className="bg-gray-50 font-bold text-gray-500 uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">Item Info</th>
                              <th className="px-4 py-3">Taxonomy</th>
                              <th className="px-4 py-3">Price</th>
                              <th className="px-4 py-3 text-center">Stock</th>
                              <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-gray-700">
                            {products.filter(p => {
                              const matchesSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
                                                    (p.brand || "").toLowerCase().includes(adminSearch.toLowerCase());
                              const matchesCategory = adminCategoryFilter === "All" || p.category === adminCategoryFilter;
                              return matchesSearch && matchesCategory;
                            }).length === 0 ? (
                              <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-450 font-medium">
                                  No products found in database catalog.
                                </td>
                              </tr>
                            ) : (
                              products.filter(p => {
                                const matchesSearch = p.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
                                                      (p.brand || "").toLowerCase().includes(adminSearch.toLowerCase());
                                const matchesCategory = adminCategoryFilter === "All" || p.category === adminCategoryFilter;
                                return matchesSearch && matchesCategory;
                              }).map(p => {
                                const isOutOfStock = p.stock === 0;
                                const isLowStock = p.stock > 0 && p.stock <= 5;
                                return (
                                  <tr key={p.id} className="hover:bg-gray-50/50 transition">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-gray-50 border border-gray-200 rounded p-1 overflow-hidden shrink-0 flex items-center justify-center">
                                          <img src={p.image} alt={p.name} className="h-full w-full object-contain" onError={e => {e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder-product.png";}} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="font-bold text-gray-900 truncate max-w-[200px]">{p.name}</div>
                                          <div className="text-[9px] text-gray-400 uppercase font-semibold mt-0.5">{p.brand} &middot; {p.unit}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-gray-800">{p.category}</div>
                                      <div className="text-[9px] text-gray-400 mt-0.5">{p.subcategory || "No subcategory"} &middot; <span className="capitalize">{p.shopType}</span></div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="font-bold text-[#2D6A4F]">KSh {p.price.toLocaleString()}</div>
                                      {p.originalPrice && (
                                        <div className="text-[9px] text-gray-400 line-through">KSh {p.originalPrice.toLocaleString()}</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          onClick={() => handleQuickStockUpdate(p.id, p.stock - 1)}
                                          disabled={p.stock === 0}
                                          className="w-5 h-5 border border-gray-200 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 font-bold transition disabled:opacity-30 cursor-pointer"
                                        >
                                          -
                                        </button>
                                        <span className={`w-10 font-mono font-bold text-center py-0.5 rounded text-[11px] ${
                                          isOutOfStock ? "bg-red-50 text-red-600 border border-red-100" :
                                          isLowStock ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                          "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                        }`}>
                                          {p.stock}
                                        </span>
                                        <button
                                          onClick={() => handleQuickStockUpdate(p.id, p.stock + 1)}
                                          className="w-5 h-5 border border-gray-200 rounded bg-white hover:bg-gray-50 flex items-center justify-center text-gray-550 font-bold transition cursor-pointer"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => handleEditClick(p)}
                                          className="px-2.5 py-1 border border-[#2D6A4F]/25 text-[#2D6A4F] hover:bg-[#2D6A4F]/5 rounded font-bold text-[10px] uppercase tracking-wider transition cursor-pointer"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteProduct(p.id)}
                                          className="p-1 hover:bg-red-50 hover:text-red-650 text-gray-400 rounded transition cursor-pointer"
                                          title="Delete SKU"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* SERVICES REQUEST KANBAN */}
                {activeSection === "services" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Service Board</h2>
                      <p className="text-xs text-gray-500 mt-1">Manage veterinary, soil testing, and advisory farm requests</p>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      {serviceRequests.map((col) => (
                        <div key={col.title} className="bg-gray-50 rounded-xl p-3 min-h-[400px]">
                          <div className="flex items-center justify-between mb-3 border-b border-gray-200/50 pb-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider text-${col.color}-700`}>{col.title}</span>
                            <span className={`text-[9px] font-bold bg-${col.color}-100 text-${col.color}-700 px-2 py-0.5 rounded-full`}>{col.items.length}</span>
                          </div>
                          <div className="space-y-2">
                            {col.items.length === 0 ? (
                              <div className="text-center py-8 text-[10px] text-gray-400 italic">No tasks</div>
                            ) : (
                              col.items.map((item: any, i: number) => (
                                <div key={i} className="bg-white rounded-lg border border-gray-100 p-3 shadow-xs hover:shadow-md transition">
                                  <span className="text-xs font-bold text-gray-800 block">{item.service}</span>
                                  <span className="text-[10px] text-gray-600 block mt-1 font-medium">{item.farmer} — {item.county}</span>
                                  <span className="text-[9px] text-gray-400 block mt-0.5">{item.date}</span>
                                  <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between gap-1">
                                    {col.status !== "completed" && (
                                      <button
                                        onClick={() => {
                                          const nextStatusMap: Record<string, string> = {
                                            requested: "assigned",
                                            assigned: "in_progress",
                                            in_progress: "completed"
                                          };
                                          handleUpdateServiceStatus(item.id, nextStatusMap[col.status]);
                                        }}
                                        className="text-[9px] font-bold text-[#2D6A4F] hover:underline cursor-pointer"
                                      >
                                        Advance →
                                      </button>
                                    )}
                                    {col.status !== "requested" && (
                                      <button
                                        onClick={() => handleUpdateServiceStatus(item.id, "cancelled")}
                                        className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CONTENT MANAGEMENT */}
                {activeSection === "content" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Content Management</h2>
                        <p className="text-xs text-gray-500 mt-1">Manage Mqulima news, blogs, and agronomy publications</p>
                      </div>
                      <button
                        onClick={() => setIsPostCreateOpen(true)}
                        className="flex items-center gap-2 bg-[#2D6A4F] hover:bg-[#1B4D35] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        <Plus className="h-4 w-4" />
                        New Article
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                              <th className="py-3 px-4">Title</th>
                              <th className="py-3 px-4">Author</th>
                              <th className="py-3 px-4">Category</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4">Views</th>
                              <th className="py-3 px-4">Published At</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-xs text-gray-600">
                            {contentList.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-12 text-center text-gray-400 italic">No publications found. Click "New Article" to create one.</td>
                              </tr>
                            ) : (
                              contentList.map((post: any) => (
                                <tr key={post.id} className="hover:bg-gray-50/50">
                                  <td className="py-3.5 px-4 font-semibold text-gray-900 max-w-[220px] truncate">{post.title}</td>
                                  <td className="py-3.5 px-4 text-gray-500">{post.author_name || "—"}</td>
                                  <td className="py-3.5 px-4"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold capitalize">{post.category || "General"}</span></td>
                                  <td className="py-3.5 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${post.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                      {post.status}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-gray-400">{post.view_count ?? 0}</td>
                                  <td className="py-3.5 px-4 text-gray-400 font-mono text-[10px]">{post.published_at ? new Date(post.published_at).toLocaleDateString() : "Draft"}</td>
                                  <td className="py-3.5 px-4 text-right space-x-2">
                                    <button
                                      onClick={() => openEditPost(post)}
                                      className="text-xs text-blue-500 hover:underline font-bold cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <span className="text-gray-200">|</span>
                                    <button
                                      onClick={() => handleToggleContentStatus(post.id)}
                                      className="text-xs text-[#2D6A4F] hover:underline font-bold cursor-pointer"
                                    >
                                      {post.status === "published" ? "Make Draft" : "Publish"}
                                    </button>
                                    <span className="text-gray-200">|</span>
                                    <button
                                      onClick={() => handleDeleteContent(post.id)}
                                      className="text-xs text-red-500 hover:underline font-bold cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Create Blog Post Modal */}
                    <AnimatePresence>
                      {isPostCreateOpen && (
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                          onClick={(e) => { if (e.target === e.currentTarget) setIsPostCreateOpen(false); }}
                        >
                          <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                          >
                            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                              <div>
                                <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily: "Playfair Display, serif" }}>Create New Article</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Published articles appear live on the Mkulima News page</p>
                              </div>
                              <button onClick={() => setIsPostCreateOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                                <X className="h-4 w-4 text-gray-400" />
                              </button>
                            </div>
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!postTitle.trim() || !postBody.trim() || !postAuthorId) {
                                  toast.error("Please fill in title, body, and select an author.");
                                  return;
                                }
                                setSavingPost(true);
                                try {
                                  await createAdminBlogPost({
                                    data: {
                                      title: postTitle.trim(),
                                      category: postCategory,
                                      excerpt: postExcerpt.trim(),
                                      body: postBody.trim(),
                                      coverImage: postCoverImage.trim(),
                                      authorId: postAuthorId,
                                      status: postStatus,
                                    }
                                  });
                                  toast.success(`Article "${postTitle}" ${postStatus === 'published' ? 'published' : 'saved as draft'} successfully!`);
                                  setIsPostCreateOpen(false);
                                  setPostTitle(""); setPostCategory("Farm Tips"); setPostExcerpt(""); setPostBody(""); setPostCoverImage(""); setPostStatus("published");
                                  const updated = await getAdminContent();
                                  setContentList(updated || []);
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to create article");
                                } finally {
                                  setSavingPost(false);
                                }
                              }}
                              className="p-6 space-y-4"
                            >
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Article Title *</label>
                                <input type="text" required value={postTitle} onChange={e => setPostTitle(e.target.value)}
                                  placeholder="e.g. How Kenyan Farmers Are Beating Drought with Drip Irrigation"
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Category</label>
                                  <select value={postCategory} onChange={e => setPostCategory(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] cursor-pointer"
                                  >
                                    <option value="Farm Tips">Farm Tips</option>
                                    <option value="Market Prices">Market Prices</option>
                                    <option value="Agri-Tech">Agri-Tech</option>
                                    <option value="Policy & Finance">Policy &amp; Finance</option>
                                    <option value="Livestock">Livestock</option>
                                    <option value="Export & Trade">Export &amp; Trade</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Author</label>
                                  <select value={postAuthorId} onChange={e => setPostAuthorId(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] cursor-pointer"
                                  >
                                    {blogAuthors.map((a: any) => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Short Excerpt (shown in feed)</label>
                                <input type="text" value={postExcerpt} onChange={e => setPostExcerpt(e.target.value)}
                                  placeholder="One-sentence summary of the article..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cover Image URL (optional)</label>
                                <input type="text" value={postCoverImage} onChange={e => setPostCoverImage(e.target.value)}
                                  placeholder="https://images.unsplash.com/..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Article Body *</label>
                                <textarea required rows={8} value={postBody} onChange={e => setPostBody(e.target.value)}
                                  placeholder="Write the full article here. Use line breaks for paragraphs..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] transition resize-none"
                                />
                              </div>
                              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                                <div className="flex items-center gap-3">
                                  <label className="text-xs font-bold text-gray-600">Publish immediately:</label>
                                  <button type="button"
                                    onClick={() => setPostStatus(s => s === "published" ? "draft" : "published")}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${postStatus === "published" ? "bg-[#2D6A4F]" : "bg-gray-300"}`}
                                  >
                                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${postStatus === "published" ? "translate-x-5" : ""}`} />
                                  </button>
                                  <span className={`text-xs font-bold ${postStatus === "published" ? "text-green-600" : "text-yellow-600"}`}>
                                    {postStatus === "published" ? "Published" : "Draft"}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => setIsPostCreateOpen(false)}
                                    className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
                                  >
                                    Cancel
                                  </button>
                                  <button type="submit" disabled={savingPost}
                                    className="px-5 py-2 bg-[#2D6A4F] hover:bg-[#1B4D35] text-white rounded-xl text-xs font-bold transition disabled:opacity-60"
                                  >
                                    {savingPost ? "Saving..." : postStatus === "published" ? "Publish Article" : "Save as Draft"}
                                  </button>
                                </div>
                              </div>
                            </form>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Edit Blog Post Modal */}
                    <AnimatePresence>
                      {editingPost && (
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                          onClick={(e) => { if (e.target === e.currentTarget) setEditingPost(null); }}
                        >
                          <motion.div
                            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                          >
                            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                              <div>
                                <h3 className="font-bold text-gray-900 text-base" style={{ fontFamily: "Playfair Display, serif" }}>Edit Article</h3>
                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-sm">{editingPost.title}</p>
                              </div>
                              <button onClick={() => setEditingPost(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                                <X className="h-4 w-4 text-gray-400" />
                              </button>
                            </div>
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (!editPostTitle.trim() || !editPostBody.trim() || !editPostAuthorId) {
                                  toast.error("Title, body, and author are required.");
                                  return;
                                }
                                setSavingEditPost(true);
                                try {
                                  await updateAdminBlogPost({
                                    data: {
                                      postId: editingPost.id,
                                      title: editPostTitle.trim(),
                                      category: editPostCategory,
                                      excerpt: editPostExcerpt.trim(),
                                      body: editPostBody.trim(),
                                      coverImage: editPostCoverImage.trim(),
                                      authorId: editPostAuthorId,
                                      status: editPostStatus,
                                    }
                                  });
                                  toast.success(`Article updated successfully!`);
                                  setEditingPost(null);
                                  const updated = await getAdminContent();
                                  setContentList(updated || []);
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to update article");
                                } finally {
                                  setSavingEditPost(false);
                                }
                              }}
                              className="p-6 space-y-4"
                            >
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Article Title *</label>
                                <input type="text" required value={editPostTitle} onChange={e => setEditPostTitle(e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Category</label>
                                  <select value={editPostCategory} onChange={e => setEditPostCategory(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] cursor-pointer"
                                  >
                                    <option value="Farm Tips">Farm Tips</option>
                                    <option value="Market Prices">Market Prices</option>
                                    <option value="Agri-Tech">Agri-Tech</option>
                                    <option value="Policy & Finance">Policy &amp; Finance</option>
                                    <option value="Livestock">Livestock</option>
                                    <option value="Export & Trade">Export &amp; Trade</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Author</label>
                                  <select value={editPostAuthorId} onChange={e => setEditPostAuthorId(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] cursor-pointer"
                                  >
                                    {blogAuthors.map((a: any) => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Short Excerpt</label>
                                <input type="text" value={editPostExcerpt} onChange={e => setEditPostExcerpt(e.target.value)}
                                  placeholder="One-sentence summary shown in the feed..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Cover Image URL</label>
                                <input type="text" value={editPostCoverImage} onChange={e => setEditPostCoverImage(e.target.value)}
                                  placeholder="https://images.unsplash.com/..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Article Body *</label>
                                <textarea required rows={10} value={editPostBody} onChange={e => setEditPostBody(e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F] transition resize-none"
                                />
                              </div>
                              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                                <div className="flex items-center gap-3">
                                  <label className="text-xs font-bold text-gray-600">Published:</label>
                                  <button type="button"
                                    onClick={() => setEditPostStatus(s => s === "published" ? "draft" : "published")}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${editPostStatus === "published" ? "bg-[#2D6A4F]" : "bg-gray-300"}`}
                                  >
                                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editPostStatus === "published" ? "translate-x-5" : ""}`} />
                                  </button>
                                  <span className={`text-xs font-bold ${editPostStatus === "published" ? "text-green-600" : "text-yellow-600"}`}>
                                    {editPostStatus === "published" ? "Published" : "Draft"}
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => setEditingPost(null)}
                                    className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
                                  >
                                    Cancel
                                  </button>
                                  <button type="submit" disabled={savingEditPost}
                                    className="px-5 py-2 bg-[#2D6A4F] hover:bg-[#1B4D35] text-white rounded-xl text-xs font-bold transition disabled:opacity-60"
                                  >
                                    {savingEditPost ? "Saving..." : "Save Changes"}
                                  </button>
                                </div>
                              </div>
                            </form>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* FORUM MODERATION */}
                {activeSection === "forum" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Forum Moderation</h2>
                      <p className="text-xs text-gray-500 mt-1">Review community stories, learning notes, and crop tragedy feeds</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                              <th className="py-3 px-4">Author</th>
                              <th className="py-3 px-4">Type</th>
                              <th className="py-3 px-4">Title / Caption</th>
                              <th className="py-3 px-4">Likes</th>
                              <th className="py-3 px-4">Created At</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-xs text-gray-600">
                            {forumList.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-12 text-center text-gray-400 italic">No community posts found in database</td>
                              </tr>
                            ) : (
                              forumList.map((post: any) => (
                                <tr key={post.id} className="hover:bg-gray-50/50">
                                  <td className="py-3.5 px-4 font-semibold text-gray-900">{post.author_name || "Unknown Farmer"}</td>
                                  <td className="py-3.5 px-4"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold capitalize">{post.type}</span></td>
                                  <td className="py-3.5 px-4 max-w-xs truncate">
                                    <div className="font-medium text-gray-800">{post.title || "No Title"}</div>
                                    <div className="text-[10px] text-gray-400 truncate">{post.caption || "No caption"}</div>
                                  </td>
                                  <td className="py-3.5 px-4 font-bold text-gray-500">{post.like_count || 0}</td>
                                  <td className="py-3.5 px-4 text-gray-400 font-mono text-[10px]">{new Date(post.created_at).toLocaleDateString()}</td>
                                  <td className="py-3.5 px-4 text-right">
                                    <button
                                      onClick={() => handleDeleteForumPost(post.id)}
                                      className="text-xs text-red-500 hover:underline font-bold cursor-pointer"
                                    >
                                      Remove Post
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* USER ACCOUNTS */}
                {activeSection === "users" && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Admin Roles & Staff</h2>
                        <p className="text-xs text-gray-500 mt-1">Manage admin permissions, staff members, and system roles</p>
                      </div>
                      <button
                        onClick={() => setIsAdminCreateOpen(true)}
                        className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Plus className="h-4 w-4" /> Add Administrator
                      </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                              <th className="py-3 px-4">Name</th>
                              <th className="py-3 px-4">Email</th>
                              <th className="py-3 px-4">Role</th>
                              <th className="py-3 px-4">Joined Date</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-xs text-gray-600">
                            {usersList.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-12 text-center text-gray-400 italic">No users registered in database</td>
                              </tr>
                            ) : (
                              usersList.map((user: any) => (
                                <tr key={user.id} className="hover:bg-gray-50/50">
                                  <td className="py-3.5 px-4 font-semibold text-gray-900">{user.full_name}</td>
                                  <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">{user.email}</td>
                                  <td className="py-3.5 px-4">
                                    <select
                                      value={user.role}
                                      onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                                      className="border border-gray-200 bg-white rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-[#2D6A4F] font-semibold cursor-pointer"
                                    >
                                      <option value="super_admin">Super Admin</option>
                                      <option value="admin">Admin</option>
                                      <option value="sales_agent">Sales Agent</option>
                                      <option value="content_editor">Content Editor</option>
                                    </select>
                                  </td>
                                  <td className="py-3.5 px-4 text-gray-400 font-mono text-[10px]">{new Date(user.created_at).toLocaleDateString()}</td>
                                  <td className="py-3.5 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.deleted_at ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                      {user.deleted_at ? "Deleted" : "Active"}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    {!user.deleted_at && (
                                      <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="text-xs text-red-500 hover:underline font-bold cursor-pointer"
                                      >
                                        Delete User
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* CUSTOMER DIRECTORY */}
                {activeSection === "customers" && (
                  <CustomerManager adminUser={adminUser} />
                )}

                {/* INQUIRIES (WHATSAPP STYLE) */}
                {activeSection === "inquiries" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>Inquiries Inbox</h2>
                        <p className="text-xs text-gray-500 mt-1">Real-time visitor inquiries and partnership requests styled like WhatsApp</p>
                      </div>
                      <div className="text-xs font-semibold text-[#2D6A4F] bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                        Live Inbox Active
                      </div>
                    </div>

                    {/* Chat Board Grid */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex h-[620px] w-full">
                      {/* Left Panel: Threads List */}
                      <div className="w-[360px] border-r border-gray-200 bg-white flex flex-col h-full shrink-0">
                        {/* Search and Tabs Header */}
                        <div className="p-4 bg-gray-50/70 border-b border-gray-100 space-y-3 shrink-0">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search chats by name, email..."
                              value={inquirySearch}
                              onChange={(e) => setInquirySearch(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 pl-9 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                            />
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                          </div>
                          
                          {/* Tabs */}
                          <div className="flex gap-1.5">
                            {[
                              { id: "all", label: "All" },
                              { id: "unread", label: "Unread" },
                              { id: "resolved", label: "Resolved" },
                            ].map(t => (
                              <button
                                key={t.id}
                                onClick={() => setInquiryFilter(t.id as any)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition cursor-pointer ${
                                  inquiryFilter === t.id
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                }`}
                              >
                                {t.label}
                                {t.id === "unread" && inquiries.filter(x => !readInquiryIds.includes(x.id)).length > 0 && (
                                  <span className="ml-1 bg-amber-400 text-amber-950 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                                    {inquiries.filter(x => !readInquiryIds.includes(x.id)).length}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                          {inquiries
                            .filter(inq => {
                              if (inquirySearch.trim()) {
                                const q = inquirySearch.toLowerCase();
                                return (
                                  inq.name.toLowerCase().includes(q) ||
                                  inq.email.toLowerCase().includes(q) ||
                                  inq.subject.toLowerCase().includes(q)
                                );
                              }
                              return true;
                            })
                            .filter(inq => {
                              if (inquiryFilter === "unread") {
                                return !readInquiryIds.includes(inq.id);
                              }
                              if (inquiryFilter === "resolved") {
                                return resolvedInquiryIds.includes(inq.id);
                              }
                              return true;
                            })
                            .length === 0 ? (
                              <div className="p-8 text-center text-gray-400 text-xs">
                                <Inbox className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                No inquiries found
                              </div>
                            ) : (
                              inquiries
                                .filter(inq => {
                                  if (inquirySearch.trim()) {
                                    const q = inquirySearch.toLowerCase();
                                    return (
                                      inq.name.toLowerCase().includes(q) ||
                                      inq.email.toLowerCase().includes(q) ||
                                      inq.subject.toLowerCase().includes(q)
                                    );
                                  }
                                  return true;
                                })
                                .filter(inq => {
                                  if (inquiryFilter === "unread") {
                                    return !readInquiryIds.includes(inq.id);
                                  }
                                  if (inquiryFilter === "resolved") {
                                    return resolvedInquiryIds.includes(inq.id);
                                  }
                                  return true;
                                })
                                .map(inq => {
                                  const isSelected = selectedInquiry?.id === inq.id;
                                  const isUnread = !readInquiryIds.includes(inq.id);
                                  const isResolved = resolvedInquiryIds.includes(inq.id);

                                  return (
                                    <button
                                      key={inq.id}
                                      onClick={() => setSelectedInquiry(inq)}
                                      className={`w-full text-left p-4 flex gap-3 transition cursor-pointer hover:bg-gray-50/80 items-start ${
                                        isSelected ? "bg-emerald-50/50 border-l-4 border-emerald-600 pl-3" : ""
                                      }`}
                                    >
                                      {/* Avatar */}
                                      <div className={`h-11 w-11 rounded-full text-white font-bold flex items-center justify-center shrink-0 border shadow-xs ${
                                        isSelected ? "bg-emerald-600 border-white" : "bg-emerald-700/80 border-transparent"
                                      }`}>
                                        {inq.name.substring(0, 2).toUpperCase()}
                                      </div>

                                      {/* Details preview */}
                                      <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex justify-between items-baseline gap-2">
                                          <h4 className="text-xs font-bold text-gray-900 truncate">{inq.name}</h4>
                                          <span className="text-[9px] text-gray-400 font-mono shrink-0">{inq.time}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-emerald-800 truncate">{inq.subject}</div>
                                        <p className="text-[10px] text-gray-400 truncate">{inq.message}</p>
                                      </div>

                                      {/* Status tag */}
                                      <div className="flex flex-col items-end gap-1.5 shrink-0 justify-between self-stretch">
                                        {isUnread ? (
                                          <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                                        ) : (
                                          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                        )}
                                        {isResolved && (
                                          <span className="text-[8px] bg-gray-150 text-gray-650 px-1.5 py-0.5 rounded font-black uppercase tracking-wider scale-90">Done</span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })
                            )}
                        </div>
                      </div>

                      {/* Right Panel: Chat Pane */}
                      <div className="flex-1 bg-[#f0f2f5] flex flex-col h-full overflow-hidden relative">
                        {selectedInquiry ? (
                          <>
                            {/* Chat Header */}
                            <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 shadow-2xs z-10">
                              <div className="flex items-center gap-3 text-left min-w-0 mr-4">
                                <div className="h-10 w-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center shadow-xs shrink-0">
                                  {selectedInquiry.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="text-left min-w-0">
                                  <h3 className="text-xs font-black text-gray-800 block leading-tight truncate">{selectedInquiry.name}</h3>
                                  <span className="text-[10px] text-gray-400 block font-mono mt-0.5 truncate">{selectedInquiry.email} • {selectedInquiry.phone}</span>
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleResolveInquiry(selectedInquiry.id)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5 ${
                                    resolvedInquiryIds.includes(selectedInquiry.id)
                                      ? "bg-gray-200 text-gray-650 hover:bg-gray-300"
                                      : "bg-[#2D6A4F] text-white hover:bg-emerald-800 shadow-sm"
                                  }`}
                                >
                                  {resolvedInquiryIds.includes(selectedInquiry.id) ? (
                                    <>Reopen Inquiry</>
                                  ) : (
                                    <>Mark Resolved</>
                                  )}
                                </button>
                                
                                <button
                                  onClick={() => handleDeleteInquiry(selectedInquiry.id)}
                                  className="p-2 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg transition cursor-pointer"
                                  title="Delete inquiry permanently"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {/* Chat Messages Pane (WhatsApp wall styled) */}
                            <div 
                              className="flex-1 overflow-y-auto p-6 space-y-4"
                              style={{ 
                                backgroundColor: "#efeae2",
                                backgroundImage: "radial-gradient(#dfdcd6 1px, transparent 1px)",
                                backgroundSize: "20px 20px"
                              }}
                            >
                              {/* Date stamp */}
                              <div className="flex justify-center">
                                <span className="bg-white/80 backdrop-blur-xs text-gray-500 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-gray-200/50">
                                  Received {selectedInquiry.date}
                                </span>
                              </div>

                              {/* WhatsApp Chat Bubble */}
                              <div className="flex items-start gap-2 max-w-[85%]">
                                <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm border border-gray-150 relative text-left">
                                  {/* Bubble Tail */}
                                  <div className="absolute top-0 -left-2.5 w-3 h-3 bg-white border-l border-b border-gray-150" style={{ transform: "rotate(45deg)", borderRightColor: "transparent", borderTopColor: "transparent", clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />

                                  {/* Sender name & Type tag */}
                                  <div className="flex items-center gap-2 mb-2 justify-between">
                                    <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">{selectedInquiry.userType} Account</span>
                                    <span className="text-[9px] font-bold font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{selectedInquiry.phone}</span>
                                  </div>

                                  {/* Subject */}
                                  <h4 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2 mb-2">
                                    Subject: {selectedInquiry.subject}
                                  </h4>

                                  {/* Text Body */}
                                  <p className="text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                                    {selectedInquiry.message}
                                  </p>

                                  {/* Timestamp + checkmark */}
                                  <div className="flex items-center justify-end gap-1 mt-3">
                                    <span className="text-[9px] text-gray-400 font-mono">
                                      {new Date(selectedInquiry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                    </span>
                                    <CheckCheck className={`h-3.5 w-3.5 ${resolvedInquiryIds.includes(selectedInquiry.id) ? "text-blue-500" : "text-gray-400"}`} />
                                  </div>
                                </div>
                              </div>

                              {/* Optional Admin Reply System (WhatsApp Style UI) */}
                              <div className="flex justify-center mt-6">
                                <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-4 max-w-lg w-full flex flex-col items-center gap-3 text-center">
                                  <h4 className="text-xs font-bold text-emerald-950">🌱 Reply to {selectedInquiry.name}</h4>
                                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                                    Connect directly to the inquirer using WhatsApp or Email to answer their question.
                                  </p>
                                  <div className="flex gap-2 w-full justify-center">
                                    <a
                                      href={`https://wa.me/${selectedInquiry.phone.replace(/[^0-9]/g, "")}?text=Hello%20${encodeURIComponent(selectedInquiry.name)}%2C%20this%20is%20Mqulima%20Support%20replying%20to%20your%20inquiry%20regarding%20%22${encodeURIComponent(selectedInquiry.subject)}%22...`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 bg-[#25D366] hover:bg-[#20BA56] text-white text-[10px] font-bold uppercase tracking-wider py-2 px-3 rounded-lg shadow-sm hover:shadow transition text-center flex items-center justify-center gap-1.5"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 shrink-0" /> Chat WhatsApp
                                    </a>
                                    <a
                                      href={`mailto:${selectedInquiry.email}?subject=Reply%20to%20your%20inquiry%20regarding%2520${encodeURIComponent(selectedInquiry.subject)}&body=Hello%20${encodeURIComponent(selectedInquiry.name)}%2C%20thank%20you%20for%2520reaching%252520out%2520to%2520Mqulima...`}
                                      className="flex-1 bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 text-[10px] font-bold uppercase tracking-wider py-2 px-3 rounded-lg shadow-sm hover:shadow transition text-center flex items-center justify-center gap-1.5"
                                    >
                                      <Mail className="h-3.5 w-3.5 shrink-0" /> Reply Email
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#efeae2] relative">
                            <div className="absolute inset-0 bg-[#efeae2]" style={{ backgroundImage: "radial-gradient(#dfdcd6 1px, transparent 1px)", backgroundSize: "20px 20px", opacity: 0.6 }} />
                            <div className="relative z-10 max-w-sm space-y-3.5">
                              <div className="h-16 w-16 rounded-full bg-emerald-600/10 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-250/30 shadow-xs">
                                <MessageCircle className="h-8 w-8 stroke-[1.5]" />
                              </div>
                              <h3 className="text-sm font-bold text-gray-800">Select a Conversation</h3>
                              <p className="text-xs text-gray-500 leading-normal">
                                Click on any visitor inquiry thread in the left sidebar to view their full message, type information, and respond instantly.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ACADEMY MANAGEMENT */}
                {activeSection === "academy" && (
                  <AcademyBuilder />
                )}

                {/* MARKETS MANAGEMENT */}
                {activeSection === "markets" && (
                  <MarketsBuilder />
                )}

                {/* SYSTEM SETTINGS & AUDIT LOGS */}
                {activeSection === "settings" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>System Settings & Logs</h2>
                      <p className="text-xs text-gray-500 mt-1">Monitor server nodes, verify security posture, and audit system activities</p>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      {/* Connection Settings */}
                      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Database Connection</h3>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">DBMS:</span><span className="font-semibold text-gray-800">PostgreSQL 16</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Host:</span><span className="font-semibold text-gray-800 font-mono">localhost:5433</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Database:</span><span className="font-semibold text-gray-800 font-mono">mqulima_dev</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Pool Size:</span><span className="font-semibold text-gray-800 font-mono">10 Connections</span></div>
                        </div>
                      </div>

                      {/* Security Posture */}
                      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Security Safeguards</h3>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">CSRF Validation:</span><span className="text-green-600 font-bold">Enabled</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Rate Limiter:</span><span className="text-green-600 font-bold">Enabled (Token Bucket)</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Session Cookies:</span><span className="text-green-600 font-bold">HttpOnly, Secure</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">CSP Protection:</span><span className="text-green-600 font-bold">Strict Headers</span></div>
                        </div>
                      </div>

                      {/* Payment configuration */}
                      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Payment Gateway</h3>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Gateway:</span><span className="font-semibold text-gray-800 font-mono">Safaricom Daraja API</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Channel:</span><span className="font-semibold text-gray-800">M-Pesa STK Push</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Sandbox/Live:</span><span className="text-yellow-600 font-bold uppercase">Sandbox</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Callback Status:</span><span className="text-green-600 font-bold">Configured (/api/mpesa/callback)</span></div>
                        </div>
                      </div>
                    </div>

                    {/* LIVE AUDIT LOG TABLE */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs">
                      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Security Audit Logs</h3>
                        <span className="text-[10px] text-gray-400">Showing last 100 operations</span>
                      </div>
                      <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                              <th className="py-2.5 px-4">Operator</th>
                              <th className="py-2.5 px-4">Action</th>
                              <th className="py-2.5 px-4">Entity Type</th>
                              <th className="py-2.5 px-4">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-xs text-gray-600 font-mono">
                            {auditLogs.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-gray-400 italic font-sans">No audit records found</td>
                              </tr>
                            ) : (
                              auditLogs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-gray-50/50">
                                  <td className="py-2.5 px-4 font-sans font-semibold text-gray-900">{log.actor_name || "System"}</td>
                                  <td className="py-2.5 px-4 text-blue-600 font-semibold">{log.action}</td>
                                  <td className="py-2.5 px-4 capitalize font-sans">{log.entity_type}</td>
                                  <td className="py-2.5 px-4 text-gray-400 text-[10px]">{new Date(log.created_at).toLocaleString()}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Create / Edit Modal Overlay */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-[#0A0F0D]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-gray-150 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>
                    {isFeaturedFormMode
                      ? (editingProduct ? "Modify Featured Product" : "Register Featured Product")
                      : (editingProduct ? "Modify Catalog Item" : "Register New Product SKU")
                    }
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {isFeaturedFormMode
                      ? "Provide title, category, and premium showcase images"
                      : "Provide accurate pricing, unit, inventory level, and description details"
                    }
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); resetForm(); }}
                  className="p-1.5 hover:bg-gray-100 text-gray-450 hover:text-gray-700 rounded-lg transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4">
                {isFeaturedFormMode ? (
                  // BRIEF FORM FOR FEATURED PRODUCTS
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-455 mb-1">Product Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Premium Tomato Anna F1"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-455 mb-1">Category</label>
                      <select
                        value={formCategory}
                        onChange={e => setFormCategory(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 outline-none focus:border-[#2D6A4F] cursor-pointer transition font-semibold"
                      >
                        {AGRICULTURE_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-150">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500">Product Images</label>
                        <span className="text-[10px] text-gray-400 font-extrabold">{formImages.length} images loaded</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Paste image URL..."
                              value={newImageUrl}
                              onChange={e => setNewImageUrl(e.target.value)}
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-850 outline-none focus:border-[#2D6A4F] transition"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (newImageUrl.trim()) {
                                  const updated = [...formImages, newImageUrl.trim()];
                                  setFormImages(updated);
                                  if (updated.length === 1) {
                                    setFormImage(newImageUrl.trim());
                                  }
                                  setNewImageUrl("");
                                  toast.success("Image URL added!");
                                }
                              }}
                              className="bg-[#2D6A4F] hover:bg-[#1A5438] text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 rounded-xl transition cursor-pointer shrink-0"
                            >
                              Add URL
                            </button>
                          </div>
                        </div>

                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            id="admin-image-upload-multi-featured"
                            multiple
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files) {
                                Array.from(files).forEach(file => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    if (typeof reader.result === "string") {
                                      const base64 = reader.result;
                                      setFormImages(prev => {
                                        const updated = [...prev, base64];
                                        if (updated.length === 1) {
                                          setFormImage(base64);
                                        }
                                        return updated;
                                      });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                });
                                toast.success("Local images processed!");
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor="admin-image-upload-multi-featured"
                            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-55 border border-dashed border-gray-350 rounded-xl px-3 py-2 text-xs text-gray-600 font-extrabold cursor-pointer transition text-center"
                          >
                            <Upload size={14} className="text-gray-400" />
                            Upload Local File(s)
                          </label>
                        </div>
                      </div>

                      {formImages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                          {formImages.map((img, idx) => (
                            <div key={idx} className="relative group border border-gray-200 rounded-xl overflow-hidden bg-white p-1 shadow-sm">
                              <div className="aspect-square rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center bg-gray-50">
                                <img src={img} className="w-full h-full object-contain" alt={`preview ${idx}`} />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formImages.filter((_, i) => i !== idx);
                                  setFormImages(updated);
                                  if (idx === 0) {
                                    setFormImage(updated[0] || "");
                                  }
                                }}
                                className="absolute top-1.5 right-1.5 p-1 bg-red-500 hover:bg-red-650 rounded-lg text-white transition shadow opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Remove image"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // FULL FORM (FOR GENERAL PRODUCTS)
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Product Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Premium DAP Fertilizer"
                          value={formName}
                          onChange={e => setFormName(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Brand/Manufacturer</label>
                        <input
                          type="text"
                          placeholder="e.g. Yaraliva, Kenya Seed"
                          value={formBrand}
                          onChange={e => setFormBrand(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Base Price (KSh)</label>
                        <input
                          type="number"
                          required
                          min={1}
                          placeholder="e.g. 3500"
                          value={formPrice || ""}
                          onChange={e => setFormPrice(Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Original Price (KSh - Optional)</label>
                        <input
                          type="number"
                          placeholder="e.g. 4200"
                          value={formOriginalPrice}
                          onChange={e => setFormOriginalPrice(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Category</label>
                        <select
                          value={formCategory}
                          onChange={e => setFormCategory(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 outline-none focus:border-[#2D6A4F] cursor-pointer transition font-semibold"
                        >
                          {AGRICULTURE_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Subcategory (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Maize, Top Dressing"
                          value={formSubcategory}
                          onChange={e => setFormSubcategory(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Shop Segment</label>
                        <select
                          value={formShopType}
                          onChange={e => setFormShopType(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 outline-none focus:border-[#2D6A4F] cursor-pointer transition font-semibold"
                        >
                          <option value="agrovet">Agrovet</option>
                          <option value="specialist">Specialist Shop</option>
                          <option value="retailers">For Retailers</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Selling Unit</label>
                        <input
                          type="text"
                          placeholder="e.g. /bag, /kg, /litre, /pack"
                          value={formUnit}
                          onChange={e => setFormUnit(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Promo Badge (Optional)</label>
                        <select
                          value={formBadge}
                          onChange={e => setFormBadge(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 outline-none focus:border-[#2D6A4F] cursor-pointer transition font-semibold"
                        >
                          <option value="">No Special Promo</option>
                          <option value="Sale">Sale</option>
                          <option value="Popular">Popular</option>
                          <option value="New">New</option>
                          <option value="Organic">Organic</option>
                          <option value="Bulk Deal">Bulk Deal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Star Rating (1-5)</label>
                        <div className="flex items-center gap-1.5 h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setFormRating(val)}
                              className="hover:scale-110 transition cursor-pointer"
                            >
                              <Star
                                className={`h-4.5 w-4.5 ${
                                  val <= formRating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-gray-300"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-150">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500">Product Images (Add Multiple for Angles)</label>
                        <span className="text-[10px] text-gray-400 font-extrabold">{formImages.length} images loaded</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Paste image URL..."
                              value={newImageUrl}
                              onChange={e => setNewImageUrl(e.target.value)}
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-855 outline-none focus:border-[#2D6A4F] transition"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (newImageUrl.trim()) {
                                  const updated = [...formImages, newImageUrl.trim()];
                                  setFormImages(updated);
                                  if (updated.length === 1) {
                                    setFormImage(newImageUrl.trim());
                                  }
                                  setNewImageUrl("");
                                  toast.success("Image URL added!");
                                }
                              }}
                              className="bg-[#2D6A4F] hover:bg-[#1A5438] text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 rounded-xl transition cursor-pointer shrink-0"
                            >
                              Add URL
                            </button>
                          </div>
                        </div>

                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            id="admin-image-upload-multi"
                            multiple
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files) {
                                Array.from(files).forEach(file => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    if (typeof reader.result === "string") {
                                      const base64 = reader.result;
                                      setFormImages(prev => {
                                        const updated = [...prev, base64];
                                        if (updated.length === 1) {
                                          setFormImage(base64);
                                        }
                                        return updated;
                                      });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                });
                                toast.success("Local images processed!");
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor="admin-image-upload-multi"
                            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-55 border border-dashed border-gray-350 rounded-xl px-3 py-2 text-xs text-gray-600 font-extrabold cursor-pointer transition text-center animate-pulse"
                          >
                            <Upload size={14} className="text-gray-400 animate-bounce" />
                            Upload Local File(s)
                          </label>
                        </div>
                      </div>

                      {formImages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                          {formImages.map((img, idx) => (
                            <div key={idx} className="relative group border border-gray-200 rounded-xl overflow-hidden bg-white p-1 shadow-sm">
                              <div className="aspect-square rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center bg-gray-50">
                                <img src={img} className="w-full h-full object-contain" alt={`preview ${idx}`} />
                              </div>
                              <div className="text-[9px] font-bold text-gray-450 text-center mt-1 truncate px-1">
                                {idx === 0 ? "★ Primary" : `Angle #${idx + 1}`}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formImages.filter((_, i) => i !== idx);
                                  setFormImages(updated);
                                  if (idx === 0) {
                                    setFormImage(updated[0] || "");
                                  }
                                }}
                                className="absolute top-1.5 right-1.5 p-1 bg-red-500 hover:bg-red-650 rounded-lg text-white transition shadow opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Remove image"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Brief Description</label>
                        <span className="text-[10px] text-gray-400 font-bold">{formBriefDescription.length}/120 chars</span>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={120}
                        placeholder="Short, limited word description..."
                        value={formBriefDescription}
                        onChange={e => setFormBriefDescription(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] resize-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Product Description</label>
                      <textarea
                        rows={3}
                        placeholder="Specifications, benefits, suitable crop profiles, and application instructions..."
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] resize-none transition"
                      />
                    </div>

                    <div className="flex flex-wrap gap-6 py-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={formOrganic}
                          onChange={e => setFormOrganic(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-350 text-[#2D6A4F] focus:ring-[#2D6A4F] accent-[#2D6A4F]"
                        />
                        <span>Organic / Bio-based SKU</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={formVerified}
                          onChange={e => setFormVerified(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-350 text-[#2D6A4F] focus:ring-[#2D6A4F] accent-[#2D6A4F]"
                        />
                        <span>Verified Seller Listing</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={formIsFeatured}
                          onChange={e => setFormIsFeatured(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-350 text-[#2D6A4F] focus:ring-[#2D6A4F] accent-[#2D6A4F]"
                        />
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> Featured Showcase
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setIsCreateOpen(false); resetForm(); }}
                    className="w-full border border-gray-200 hover:bg-gray-55 text-gray-500 font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full bg-[#2D6A4F] hover:bg-[#1A5438] text-white font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition shadow-lg shadow-[#2D6A4F]/20 cursor-pointer"
                  >
                    Save SKU Info
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Admin Modal Overlay */}
      <AnimatePresence>
        {isAdminCreateOpen && (
          <div className="fixed inset-0 bg-[#0A0F0D]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 md:p-8 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-gray-150 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>
                    Add Administrator Account
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">Register a new administrator, sales agent, or content editor</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdminCreateOpen(false)}
                  className="p-1.5 hover:bg-gray-100 text-gray-450 hover:text-gray-700 rounded-lg transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAdminUser} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={adminFormFullName}
                    onChange={e => setAdminFormFullName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. johndoe@mkulima.com"
                    value={adminFormEmail}
                    onChange={e => setAdminFormEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Temporary Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 characters..."
                    value={adminFormPassword}
                    onChange={e => setAdminFormPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 outline-none focus:border-[#2D6A4F] transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Administrative Role</label>
                  <select
                    value={adminFormRole}
                    onChange={e => setAdminFormRole(e.target.value as any)}
                    className="w-full bg-gray-55 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 outline-none focus:border-[#2D6A4F] cursor-pointer transition font-semibold"
                  >
                    <option value="super_admin">Super Admin (Full Access)</option>
                    <option value="admin">Admin (Operational Access)</option>
                    <option value="sales_agent">Sales Agent</option>
                    <option value="content_editor">Content Editor</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsAdminCreateOpen(false)}
                    className="w-full border border-gray-200 hover:bg-gray-55 text-gray-500 font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdmin}
                    className="w-full bg-[#2D6A4F] hover:bg-[#1A5438] text-white font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition shadow-lg shadow-[#2D6A4F]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingAdmin ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Details Modal Overlay */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 bg-[#0A0F0D]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-gray-150 pb-4 mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>
                      Order Details: #{selectedOrder.id}
                    </h3>
                    <span className="text-[10px] bg-gray-100 text-gray-650 px-2 py-0.5 rounded font-mono font-bold capitalize">
                      {selectedOrder.channel}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Placed on {selectedOrder.date}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 hover:bg-gray-100 text-gray-450 hover:text-gray-700 rounded-lg transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Col 1: Customer Info */}
                <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-gray-100 pb-6 md:pb-0 md:pr-6 space-y-4 text-xs">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Customer / Recipient</h4>
                    <div className="font-semibold text-gray-800">{selectedOrder.customer}</div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Delivery Address & Details</h4>
                    {selectedOrder.deliveryAddress ? (
                      <pre className="font-sans whitespace-pre-wrap text-[11px] text-gray-650 bg-gray-50 border border-gray-150 p-3 rounded-xl leading-relaxed font-medium">
                        {selectedOrder.deliveryAddress}
                      </pre>
                    ) : (
                      <span className="text-gray-400 italic">No delivery address provided</span>
                    )}
                  </div>

                  {selectedOrder.notes && (
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Customer Notes / Instructions</h4>
                      <div className="text-gray-600 italic bg-amber-50/30 border border-amber-100 p-2.5 rounded-xl">
                        "{selectedOrder.notes}"
                      </div>
                    </div>
                  )}
                </div>

                {/* Col 2 & 3: Order Items */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ordered Items ({selectedOrder.items})</h4>
                  <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-1">
                    {Array.isArray(selectedOrder.rawItems) && selectedOrder.rawItems.length > 0 ? (
                      selectedOrder.rawItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                          <div className="h-12 w-12 bg-gray-50 border border-gray-200 rounded p-1 overflow-hidden shrink-0 flex items-center justify-center">
                            <img
                              src={item.image || "/placeholder-product.png"}
                              alt={item.name}
                              className="h-full w-full object-contain"
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder-product.png"; }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-gray-800 truncate">{item.name}</div>
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                              Quantity: {item.quantity} &middot; KSh {parseFloat(item.price || 0).toLocaleString()}/unit
                            </div>
                          </div>
                          <div className="text-xs font-bold text-gray-900 shrink-0">
                            KSh {(parseInt(item.quantity || 1) * parseFloat(item.price || 0)).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-400 italic text-xs">No items details found for this order</div>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span className="font-semibold text-gray-800">{selectedOrder.subtotal || selectedOrder.total}</span>
                    </div>
                    <div className="flex justify-between text-gray-900 font-extrabold text-sm border-t border-gray-50 pt-2">
                      <span>Total Amount</span>
                      <span className="text-[#2D6A4F]">{selectedOrder.total}</span>
                    </div>
                  </div>

                  {/* Status Dropdowns */}
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Order Status</label>
                      <select
                        value={selectedOrder.status}
                        onChange={(e) => handleUpdateOrderStatus(selectedOrder.rawId, e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer focus:border-[#2D6A4F]"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Payment Status</label>
                      <select
                        value={selectedOrder.payment}
                        onChange={(e) => handleUpdatePaymentStatus(selectedOrder.rawId, e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer focus:border-[#2D6A4F]"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-full bg-[#2D6A4F] hover:bg-[#1A5438] text-white font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition cursor-pointer text-center font-black"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
