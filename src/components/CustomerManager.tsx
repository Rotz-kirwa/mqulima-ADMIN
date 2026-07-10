import { useState, useEffect } from "react";
import {
  Search, Users, ChevronLeft, ChevronRight, Phone, Mail,
  Copy, Download,
  Edit2, X, ExternalLink, Eye, ArrowUpDown, RefreshCw,
  FileSpreadsheet, Lock
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import {
  getAdminCustomers,
  getAdminCustomerDetails,
  updateAdminCustomerStatus,
  updateAdminCustomerDetails,
  deleteAdminCustomer
} from "@/lib/api/admin.functions";

interface CustomerManagerProps {
  adminUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

const COUNTIES = [
  "All", "Nairobi", "Uasin Gishu", "Nyandarua", "Kericho", 
  "Machakos", "Nakuru", "Kiambu", "Nyeri", "Mombasa", "Kisumu"
];

const FARMING_TYPES = [
  "All",
  "Crop Farming (Horticulture)",
  "Crop Farming (Cereals & Grains)",
  "Livestock Farming",
  "Dairy Farming",
  "Poultry Farming",
  "Aquaculture",
  "Mixed Farming",
  "Agroforestry",
  "I'm a Buyer/Consumer Only (no farming)",
  "Other"
];

export function CustomerManager({ adminUser }: CustomerManagerProps) {
  const isWritable = ["super_admin", "admin"].includes(adminUser.role);

  // Table state
  const [customers, setCustomers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [county, setCounty] = useState("All");
  const [farmingType, setFarmingType] = useState("All");
  const [status, setStatus] = useState("All");
  const [role, setRole] = useState("All");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail Drawer state
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Edit Modal state
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    whatsappNumber: "",
    email: "",
    idNumber: "",
    countyRegion: "Nairobi",
    deliveryAddress: "",
    natureOfAgriculture: "Crop Farming (Horticulture)",
    status: "active" as "active" | "suspended" | "pending"
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Load customers
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const result = await getAdminCustomers({
        data: {
          page,
          limit,
          search,
          county,
          farmingType,
          status,
          role,
          sortBy,
          sortOrder
        }
      });
      setCustomers(result.customers);
      setTotal(result.total);
    } catch (error: any) {
      toast.error(error.message || "Failed to load customers from database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [page, search, county, farmingType, status, role, sortBy, sortOrder]);

  // Load details
  const loadDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const res = await getAdminCustomerDetails({ data: { customerId: id } });
      setDetails(res);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch customer profile");
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    if (activeCustomerId) {
      loadDetails(activeCustomerId);
    } else {
      setDetails(null);
    }
  }, [activeCustomerId]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard!`);
  };

  const formatPhoneForWhatsApp = (phoneStr: string) => {
    const clean = phoneStr.replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) {
      return "254" + clean.slice(1);
    }
    if (clean.startsWith("254")) {
      return clean;
    }
    return clean;
  };

  // Actions
  const handleToggleStatus = async (customerId: string, currentStatus: string) => {
    if (!isWritable) {
      toast.error("Access Denied: Only administrators can modify status");
      return;
    }
    const newStatus = currentStatus === "suspended" ? "active" : "suspended";
    const confirmMsg = currentStatus === "suspended" 
      ? "Reactivate this account?" 
      : "Suspend this account? The user will not be able to access fresh marketplace services.";
    
    if (!confirm(confirmMsg)) return;

    try {
      await updateAdminCustomerStatus({ data: { customerId, status: newStatus } });
      toast.success(`Account status updated to ${newStatus}`);
      loadCustomers();
      if (details && details.customer.id === customerId) {
        setDetails((prev: any) => ({
          ...prev,
          customer: { ...prev.customer, status: newStatus }
        }));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (customerId: string) => {
    if (!isWritable) {
      toast.error("Access Denied: Only administrators can delete records");
      return;
    }
    if (!confirm("Are you sure you want to delete this customer account? This will perform a soft delete and invalidate credentials.")) return;

    try {
      await deleteAdminCustomer({ data: { customerId } });
      toast.success("Customer account deleted successfully");
      setActiveCustomerId(null);
      loadCustomers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer");
    }
  };

  const handleEditClick = (customer: any) => {
    if (!isWritable) {
      toast.error("Access Denied: Only administrators can edit records");
      return;
    }
    setEditingCustomer(customer);
    setEditForm({
      fullName: customer.full_name || "",
      phone: customer.phone || "",
      whatsappNumber: customer.whatsapp_number || customer.phone || "",
      email: customer.email || "",
      idNumber: customer.id_number || "",
      countyRegion: customer.county_region || "Nairobi",
      deliveryAddress: customer.delivery_address || "",
      natureOfAgriculture: customer.nature_of_agriculture || "Crop Farming (Horticulture)",
      status: customer.status || "active"
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await updateAdminCustomerDetails({
        data: {
          customerId: editingCustomer.id,
          ...editForm
        }
      });
      toast.success("Customer details updated successfully");
      setEditingCustomer(null);
      loadCustomers();
      if (activeCustomerId && activeCustomerId === editingCustomer.id) {
        loadDetails(activeCustomerId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update details");
    } finally {
      setSavingEdit(false);
    }
  };

  // Bulk Operations
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(customers.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  // Export functions
  const exportCSV = (dataToExport = customers) => {
    if (dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Customer ID", "Full Name", "Email Address", "Phone Number", 
      "WhatsApp Number", "National ID", "County", "Delivery Address", 
      "Nature of Farming", "Account Status", "Registration Date", 
      "Last Login", "Total Orders", "Total Spent (KES)"
    ];

    const rows = dataToExport.map(c => [
      c.id,
      c.full_name,
      c.email,
      c.phone || "",
      c.whatsapp_number || "",
      c.id_number || "",
      c.county_region || "",
      c.delivery_address || "",
      c.nature_of_agriculture || "",
      c.status,
      c.created_at ? new Date(c.created_at).toLocaleDateString() : "",
      c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : "",
      c.total_orders,
      c.total_spent
    ]);

    const csvContent = 
      "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mkulima_customers_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded successfully!");
  };

  const exportProfilePDF = (profileData: any) => {
    const { customer, stats, recentOrders, favoriteProducts } = profileData;
    const doc = new jsPDF();

    // Premium green header block
    doc.setFillColor(11, 106, 71); // #0B6A47 Forest Green
    doc.rect(0, 0, 210, 38, "F");

    // Brand title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("MKULIMA HUB", 15, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(153, 217, 140); // Leaf green
    doc.text("Official Customer Profile Report", 15, 27);

    // Date
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(`Exported: ${new Date().toLocaleString()}`, 150, 20);

    // Section: Personal Info
    doc.setTextColor(11, 106, 71);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("1. Customer Account Details", 15, 52);

    doc.setDrawColor(220, 242, 208); // Light sage line separator
    doc.setLineWidth(0.5);
    doc.line(15, 55, 195, 55);

    doc.setTextColor(30, 27, 24); // Dark charcoal text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    let y = 64;
    const drawField = (label: string, val: string) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(val || "N/A"), 65, y);
      y += 8;
    };

    drawField("Customer ID:", customer.id);
    drawField("Full Name:", customer.full_name);
    drawField("Email Address:", customer.email);
    drawField("Phone Number:", customer.phone);
    drawField("WhatsApp Number:", customer.whatsapp_number);
    drawField("National ID Number:", customer.id_number);
    drawField("County Region:", customer.county_region);
    drawField("Delivery Location:", customer.delivery_address);
    drawField("Farming Interests:", customer.nature_of_agriculture);
    drawField("Account Status:", customer.status.toUpperCase());
    drawField("Registration Date:", customer.created_at ? new Date(customer.created_at).toLocaleDateString() : "N/A");
    drawField("Last Activity/Login:", customer.last_login_at ? new Date(customer.last_login_at).toLocaleString() : "N/A");

    // Section: Statistics
    y += 4;
    doc.setTextColor(11, 106, 71);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("2. Business Activity Statistics", 15, y);
    y += 3;
    doc.line(15, y, 195, y);
    y += 8;

    doc.setTextColor(30, 27, 24);
    drawField("Total Purchase Count:", `${stats.totalOrders} Orders`);
    drawField("Completed Deliveries:", `${stats.completedOrders} Orders`);
    drawField("Active/Pending Orders:", `${stats.currentOrders} Orders`);
    drawField("Total Value Spent:", `KES ${stats.totalSpent.toLocaleString()}`);

    // Add page if details overflow
    if (y > 220) {
      doc.addPage();
      y = 20;
    }

    // Favorite Products
    if (favoriteProducts && favoriteProducts.length > 0) {
      doc.setTextColor(11, 106, 71);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("3. Frequently Purchased Products", 15, y);
      y += 3;
      doc.line(15, y, 195, y);
      y += 8;
      doc.setTextColor(30, 27, 24);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      favoriteProducts.forEach((p: any, idx: number) => {
        doc.text(`${idx + 1}. ${p.name} (${p.count} units)`, 20, y);
        y += 7;
      });
      y += 4;
    }

    // Recent Orders Table
    if (recentOrders && recentOrders.length > 0) {
      if (y > 200) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(11, 106, 71);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("4. Recent Order History", 15, y);
      y += 3;
      doc.line(15, y, 195, y);
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Order ID", 15, y);
      doc.text("Date Placed", 50, y);
      doc.text("Status", 100, y);
      doc.text("Total Value (KES)", 140, y);
      y += 6;
      doc.line(15, y, 195, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 27, 24);
      recentOrders.forEach((o: any) => {
        doc.text(String(o.id), 15, y);
        doc.text(String(o.date), 50, y);
        doc.text(String(o.status).toUpperCase(), 100, y);
        doc.text(`KES ${o.total.toLocaleString()}`, 140, y);
        y += 7;
      });
    }

    // Footer signature
    y = doc.internal.pageSize.height - 15;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("This document is generated dynamically from the Mkulima secure database administration portal.", 15, y);
    doc.text("Page 1 of 1", 185, y);

    doc.save(`customer_report_${customer.full_name.replace(/\s+/g, "_")}.pdf`);
    toast.success("PDF profile report generated successfully!");
  };

  const paginatedTotalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 text-left" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: "Playfair Display, serif" }}>
            <Users className="h-6 w-6 text-[#2D6A4F]" /> Customer Management
          </h2>
          <p className="text-xs text-gray-500 mt-1">View activity, filter taxonomy, download profiles, and contact registered buyers and farmers</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                const selectedRows = customers.filter(c => selectedIds.includes(c.id));
                exportCSV(selectedRows);
              }}
              className="bg-emerald-50 text-[#0B6A47] hover:bg-emerald-100 border border-[#2D6A4F]/20 text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export Selected ({selectedIds.length})
            </button>
          )}
          <button
            onClick={() => exportCSV()}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Download className="h-4 w-4 text-gray-400" /> Export Catalog (CSV)
          </button>
          <button
            onClick={loadCustomers}
            className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-500 transition cursor-pointer"
            title="Reload customers list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-[#2D6A4F]" : ""}`} />
          </button>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-xs space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {/* Search bar */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, national ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#FCFBF4] border border-gray-200 rounded-lg px-3 py-2 pl-9 text-xs outline-none focus:border-[#2D6A4F] transition"
            />
          </div>

          {/* County Filter */}
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">County</label>
            <select
              value={county}
              onChange={(e) => { setCounty(e.target.value); setPage(1); }}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#2D6A4F] font-medium text-gray-700 cursor-pointer"
            >
              {COUNTIES.map(c => <option key={c} value={c}>{c === "All" ? "All Counties" : c}</option>)}
            </select>
          </div>

          {/* Farming Type Filter */}
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Farming Focus</label>
            <select
              value={farmingType}
              onChange={(e) => { setFarmingType(e.target.value); setPage(1); }}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#2D6A4F] font-medium text-gray-700 cursor-pointer"
            >
              {FARMING_TYPES.map(ft => (
                <option key={ft} value={ft}>
                  {ft === "All" ? "All Practices" : ft.length > 22 ? ft.substring(0, 20) + "..." : ft}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#2D6A4F] font-medium text-gray-700 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Roles Filter (advanced) */}
        <div className="flex gap-2 border-t border-gray-100 pt-3">
          {["All", "farmer", "retailer"].map(r => (
            <button
              key={r}
              onClick={() => { setRole(r); setPage(1); }}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition cursor-pointer ${
                role === r 
                  ? "bg-[#2D6A4F] text-white border-[#2D6A4F]"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {r === "All" ? "All Customers" : r === "farmer" ? "Farmers" : "Retailers"}
            </button>
          ))}
        </div>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#0B6A47] text-white text-[10px] uppercase tracking-wider font-bold">
              <tr>
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={customers.length > 0 && selectedIds.length === customers.length}
                    onChange={handleSelectAll}
                    className="h-3.5 w-3.5 accent-[#2D6A4F] rounded cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">
                  <button onClick={() => handleSort("full_name")} className="flex items-center gap-1 hover:text-white/80 cursor-pointer">
                    Name <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">National ID</th>
                <th className="py-3.5 px-4">County / Address</th>
                <th className="py-3.5 px-4">Farming Practice</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">
                  <button onClick={() => handleSort("total_orders")} className="flex items-center gap-1 hover:text-white/80 cursor-pointer">
                    Orders <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button onClick={() => handleSort("total_spent")} className="flex items-center gap-1 hover:text-white/80 cursor-pointer">
                    Total Spent <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4">
                  <button onClick={() => handleSort("created_at")} className="flex items-center gap-1 hover:text-white/80 cursor-pointer">
                    Joined <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <RefreshCw className="h-8 w-8 text-[#2D6A4F] animate-spin mx-auto" />
                    <span className="text-[11px] text-gray-400 mt-2 block font-mono">Running database filter queries...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-gray-400 italic">
                    No customers found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-[#DCF2D0]/10 transition-colors ${
                        isSelected ? "bg-[#DCF2D0]/20" : ""
                      }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(c.id)}
                          className="h-3.5 w-3.5 accent-[#2D6A4F] rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-950">
                        <button
                          onClick={() => setActiveCustomerId(c.id)}
                          className="hover:text-[#2D6A4F] hover:underline font-bold text-left focus:outline-none"
                        >
                          {c.full_name}
                        </button>
                        <span className="text-[9px] text-gray-400 font-mono block mt-0.5 truncate max-w-[120px]" title={c.id}>
                          {c.id.substring(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                          <span className="font-mono text-[11px] text-gray-600 truncate max-w-[150px]">{c.email}</span>
                          <button
                            onClick={() => copyToClipboard(c.email, "Email")}
                            className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                            title="Copy email"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                          <span className="font-mono text-[11px] text-gray-600">{c.phone || "No phone"}</span>
                          {c.phone && (
                            <button
                              onClick={() => copyToClipboard(c.phone, "Phone number")}
                              className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                              title="Copy phone"
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500 text-[11px]">{c.id_number || "—"}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-800 block">{c.county_region || "Unknown"}</span>
                        <span className="text-[10px] text-gray-400 block truncate max-w-[150px]" title={c.delivery_address}>
                          {c.delivery_address || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-medium">
                        {c.nature_of_agriculture || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          c.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          c.status === "suspended" ? "bg-red-50 text-red-700 border border-red-200" :
                          "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900 text-center">{c.total_orders}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        KES {c.total_spent.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[10px]">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-4 text-center relative">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setActiveCustomerId(c.id)}
                            className="p-1 hover:bg-gray-100 rounded text-[#2D6A4F] hover:text-[#0B6A47] cursor-pointer"
                            title="View customer profile details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditClick(c)}
                            disabled={!isWritable}
                            className={`p-1 rounded cursor-pointer ${
                              isWritable ? "hover:bg-gray-100 text-amber-600 hover:text-amber-700" : "text-gray-300 cursor-not-allowed"
                            }`}
                            title={isWritable ? "Edit customer profile details" : "Requires Admin privileges"}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(c.id, c.status)}
                            disabled={!isWritable}
                            className={`p-1 rounded cursor-pointer ${
                              isWritable 
                                ? (c.status === "suspended" ? "hover:bg-gray-100 text-emerald-600" : "hover:bg-gray-100 text-red-500")
                                : "text-gray-300 cursor-not-allowed"
                            }`}
                            title={isWritable ? (c.status === "suspended" ? "Reactivate Account" : "Suspend Account") : "Requires Admin privileges"}
                          >
                            <Lock className="h-4 w-4" />
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

        {/* PAGINATION PANEL */}
        <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">
            Showing <span className="text-gray-800">{customers.length}</span> of <span className="text-gray-800">{total}</span> customers
          </span>
          {paginatedTotalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-gray-600">
                Page {page} of {paginatedTotalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(prev + 1, paginatedTotalPages))}
                disabled={page === paginatedTotalPages}
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL DRAWER */}
      <AnimatePresence>
        {activeCustomerId && (
          <>
            {/* Overlay background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCustomerId(null)}
              className="fixed inset-0 bg-black z-40"
            />

            {/* Drawer container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full sm:w-[480px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden text-left"
            >
              {detailsLoading || !details ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <RefreshCw className="h-8 w-8 text-[#2D6A4F] animate-spin" />
                  <span className="text-xs text-gray-400 mt-2 font-mono">Loading full customer file...</span>
                </div>
              ) : (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Drawer Header */}
                  <div className="bg-[#0B6A47] text-white px-6 py-5 shrink-0 flex items-center justify-between relative">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-12 w-12 rounded-full border-2 border-white bg-[#DCF2D0] text-[#0B6A47] flex items-center justify-center text-lg font-black shrink-0 shadow-md">
                        {details.customer.avatar_url ? (
                          <img src={details.customer.avatar_url} alt="Profile" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          details.customer.full_name.substring(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base truncate leading-snug">{details.customer.full_name}</h3>
                        <span className="text-white/60 text-[10px] uppercase font-mono block mt-0.5 tracking-wider">
                          Role: {details.customer.role} • ID: {details.customer.id.substring(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveCustomerId(null)}
                      className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition shrink-0 cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Drawer Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Action buttons bar */}
                    <div className="grid grid-cols-2 gap-2">
                      {details.customer.phone && (
                        <a
                          href={`https://wa.me/${formatPhoneForWhatsApp(details.customer.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition text-center"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> WhatsApp Business
                        </a>
                      )}
                      <a
                        href={`mailto:${details.customer.email}`}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition text-center"
                      >
                        <Mail className="h-3.5 w-3.5 text-gray-500" /> Send Email
                      </a>
                    </div>

                    {/* Section: Status Details */}
                    <div className="bg-[#DCF2D0]/20 border border-[#2D6A4F]/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400">Account status</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          details.customer.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          details.customer.status === "suspended" ? "bg-red-50 text-red-700 border border-red-200" :
                          "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {details.customer.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-medium">Registered Date:</span>
                        <span className="font-mono font-semibold text-gray-800">
                          {details.customer.created_at ? new Date(details.customer.created_at).toLocaleString() : "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-medium">Last Login:</span>
                        <span className="font-mono font-semibold text-gray-800">
                          {details.customer.last_login_at ? new Date(details.customer.last_login_at).toLocaleString() : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Section: Key KPI Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#FCFBF4] border border-gray-200 rounded-xl p-4">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Purchases</span>
                        <span className="text-2xl font-black text-gray-900 block leading-none">{details.stats.totalOrders}</span>
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          {details.stats.completedOrders} completed • {details.stats.currentOrders} pending
                        </span>
                      </div>
                      <div className="bg-[#FCFBF4] border border-gray-200 rounded-xl p-4">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Total Spent</span>
                        <span className="text-xl font-black text-[#2D6A4F] block leading-none truncate" title={`KES ${details.stats.totalSpent.toLocaleString()}`}>
                          KES {details.stats.totalSpent.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1 block">Live db aggregated</span>
                      </div>
                    </div>

                    {/* Section: Personal Profiles */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#2D6A4F]">Contact & Personal Details</h4>
                      <div className="bg-[#FCFBF4] rounded-xl border border-gray-200 p-4 divide-y divide-gray-100 text-xs">
                        <div className="py-2.5 flex justify-between"><span className="text-gray-400 font-medium">Email:</span><span className="font-semibold text-gray-800">{details.customer.email}</span></div>
                        <div className="py-2.5 flex justify-between"><span className="text-gray-400 font-medium">Phone Number:</span><span className="font-semibold text-gray-800 font-mono">{details.customer.phone || "—"}</span></div>
                        <div className="py-2.5 flex justify-between"><span className="text-gray-400 font-medium">WhatsApp:</span><span className="font-semibold text-gray-800 font-mono">{details.customer.whatsapp_number || "—"}</span></div>
                        <div className="py-2.5 flex justify-between"><span className="text-gray-400 font-medium">National ID:</span><span className="font-semibold text-gray-800 font-mono">{details.customer.id_number || "—"}</span></div>
                        <div className="py-2.5 flex justify-between"><span className="text-gray-400 font-medium">County:</span><span className="font-semibold text-gray-800">{details.customer.county_region || "—"}</span></div>
                        <div className="py-2.5 flex justify-between"><span className="text-gray-400 font-medium">Delivery Address:</span><span className="font-semibold text-gray-800">{details.customer.delivery_address || "—"}</span></div>
                      </div>
                    </div>

                    {/* Section: Farming Practice */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#2D6A4F]">Nature of Farming Focus</h4>
                      <div className="bg-[#FCFBF4] rounded-xl border border-gray-200 p-4 text-xs font-semibold text-gray-800">
                        {details.customer.nature_of_agriculture || "No farming profile details specified."}
                      </div>
                    </div>

                    {/* Section: Favorite Products */}
                    {details.favoriteProducts && details.favoriteProducts.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#2D6A4F]">Frequently Purchased Items</h4>
                        <div className="bg-[#FCFBF4] rounded-xl border border-gray-200 p-4 space-y-2 text-xs">
                          {details.favoriteProducts.map((fp: any, i: number) => (
                            <div key={i} className="flex justify-between items-center py-1">
                              <span className="font-semibold text-gray-800 truncate max-w-[280px]">{fp.name}</span>
                              <span className="bg-[#DCF2D0] text-[#0B6A47] text-[10px] font-bold px-2 py-0.5 rounded-full">{fp.count} bought</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section: Order History Timeline */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#2D6A4F]">Order History ({details.recentOrders.length})</h4>
                      {details.recentOrders.length === 0 ? (
                        <div className="text-xs text-gray-400 italic py-2">No orders placed by this customer.</div>
                      ) : (
                        <div className="space-y-2.5">
                          {details.recentOrders.map((o: any) => (
                            <div key={o.rawId} className="bg-white border border-gray-100 rounded-lg p-3 shadow-xs flex justify-between items-center text-xs">
                              <div>
                                <span className="font-bold text-[#2D6A4F]">{o.id}</span>
                                <span className="text-[10px] text-gray-400 block mt-0.5">{o.date}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-900">KES {o.total.toLocaleString()}</span>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  o.status === "paid" || o.status === "delivered" ? "bg-emerald-50 text-emerald-700" :
                                  o.status === "pending" ? "bg-amber-50 text-amber-700" :
                                  o.status === "cancelled" ? "bg-red-50 text-red-700" :
                                  "bg-purple-50 text-purple-700"
                                }`}>{o.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Drawer Footer Actions */}
                  <div className="p-4 bg-gray-50 border-t border-gray-100 shrink-0 flex items-center justify-between gap-3">
                    <button
                      onClick={() => exportProfilePDF(details)}
                      className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold px-3 py-2.5 rounded-lg transition flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Download className="h-4 w-4 text-gray-400" /> Export Profile (PDF)
                    </button>
                    {isWritable ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditClick(details.customer)}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2.5 rounded-lg transition cursor-pointer"
                        >
                          Edit Profile
                        </button>
                        <button
                          onClick={() => handleDelete(details.customer.id)}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-3 py-2.5 rounded-lg transition cursor-pointer"
                        >
                          Delete Account
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Read-only mode
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {editingCustomer && (
          <>
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingCustomer(null)}
              className="fixed inset-0 bg-black z-[60]"
            />

            {/* Modal dialog box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-[70] overflow-y-auto"
            >
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-left">
                {/* Header */}
                <div className="bg-[#0B6A47] text-white px-6 py-4 flex items-center justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <Edit2 className="h-4 w-4" /> Edit Customer Profile
                  </h3>
                  <button onClick={() => setEditingCustomer(null)} className="p-1 hover:bg-white/10 rounded-lg text-white/60 hover:text-white cursor-pointer">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                        className="w-full bg-[#FCFBF4] border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">National ID</label>
                      <input
                        type="text"
                        required
                        value={editForm.idNumber}
                        onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })}
                        className="w-full bg-[#FCFBF4] border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full bg-[#FCFBF4] border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Phone Number</label>
                      <input
                        type="text"
                        required
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-[#FCFBF4] border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">WhatsApp Number</label>
                      <input
                        type="text"
                        value={editForm.whatsappNumber}
                        onChange={(e) => setEditForm({ ...editForm, whatsappNumber: e.target.value })}
                        className="w-full bg-[#FCFBF4] border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-mono"
                        placeholder="Same as phone if blank"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">County</label>
                      <select
                        value={editForm.countyRegion}
                        onChange={(e) => setEditForm({ ...editForm, countyRegion: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-semibold text-gray-700 cursor-pointer"
                      >
                        {COUNTIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Delivery Location Address</label>
                    <input
                      type="text"
                      required
                      value={editForm.deliveryAddress}
                      onChange={(e) => setEditForm({ ...editForm, deliveryAddress: e.target.value })}
                      className="w-full bg-[#FCFBF4] border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-semibold"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Farming Type Focus</label>
                      <select
                        value={editForm.natureOfAgriculture}
                        onChange={(e) => setEditForm({ ...editForm, natureOfAgriculture: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-semibold text-gray-700 cursor-pointer"
                      >
                        {FARMING_TYPES.filter(ft => ft !== "All").map(ft => <option key={ft} value={ft}>{ft}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Account Status</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#2D6A4F] font-semibold text-gray-700 cursor-pointer"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCustomer(null)}
                      className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-xs font-bold text-gray-500 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-4 py-2 bg-[#2D6A4F] hover:bg-[#0B6A47] text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      {savingEdit ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving Changes...
                        </>
                      ) : (
                        "Save Profile Changes"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
