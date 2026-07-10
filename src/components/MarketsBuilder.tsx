import React, { useState, useEffect } from "react";
import { 
  TrendingUp, Plus, Trash2, MapPin, 
  ChevronRight, RefreshCw, X, HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminCommodities,
  createAdminCommodity,
  addCommodityPrice,
  deleteCommodityPrice,
  deleteAdminCommodity
} from "@/lib/api/admin.functions";

export function MarketsBuilder() {
  const [commodities, setCommodities] = useState<any[]>([]);
  const [selectedCommodity, setSelectedCommodity] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals / Form states
  const [showAddCommodity, setShowAddCommodity] = useState(false);
  const [showAddPrice, setShowAddPrice] = useState(false);
  
  // Add Commodity Form
  const [newCommName, setNewCommName] = useState("");
  const [newCommUnit, setNewCommUnit] = useState("kg");
  const [initialRegion, setInitialRegion] = useState("");
  const [initialPrice, setInitialPrice] = useState("");
  const [initialSource, setInitialSource] = useState("");
  
  // Add Price Form
  const [newPriceRegion, setNewPriceRegion] = useState("");
  const [newPriceVal, setNewPriceVal] = useState("");
  const [newPriceSource, setNewPriceSource] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAdminCommodities();
      setCommodities(data);
      if (selectedCommodity) {
        const updated = data.find(c => c.id === selectedCommodity.id);
        setSelectedCommodity(updated || null);
      }
    } catch (error) {
      console.error("Failed to load commodities:", error);
      toast.error("Error loading commodities from PostgreSQL database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddCommodity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommName.trim()) {
      toast.error("Commodity name is required");
      return;
    }
    
    try {
      const payload: any = {
        name: newCommName,
        unit: newCommUnit,
      };

      if (initialRegion.trim() && initialPrice !== "") {
        payload.region = initialRegion;
        payload.price = parseFloat(initialPrice);
        payload.source = initialSource;
      }

      await createAdminCommodity({ data: payload });
      toast.success("Commodity added successfully!");
      
      // Reset form
      setNewCommName("");
      setNewCommUnit("kg");
      setInitialRegion("");
      setInitialPrice("");
      setInitialSource("");
      setShowAddCommodity(false);
      
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create commodity");
    }
  };

  const handleDeleteCommodity = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will delete all its regional price entries.`)) {
      return;
    }

    try {
      await deleteAdminCommodity({ data: { commodityId: id } });
      toast.success(`Deleted ${name}`);
      if (selectedCommodity?.id === id) {
        setSelectedCommodity(null);
      }
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete commodity");
    }
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommodity) return;
    if (!newPriceRegion.trim() || newPriceVal === "") {
      toast.error("Region and Price are required");
      return;
    }

    try {
      await addCommodityPrice({
        data: {
          commodityId: selectedCommodity.id,
          region: newPriceRegion,
          price: parseFloat(newPriceVal),
          source: newPriceSource,
        }
      });

      toast.success("Price entry added successfully!");
      setNewPriceRegion("");
      setNewPriceVal("");
      setNewPriceSource("");
      setShowAddPrice(false);
      
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to add price entry");
    }
  };

  const handleDeletePrice = async (priceId: string) => {
    if (!confirm("Are you sure you want to delete this price entry?")) return;

    try {
      await deleteCommodityPrice({ data: { priceId } });
      toast.success("Price entry deleted");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete price entry");
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 animate-fadeIn" style={{ fontFamily: "Playfair Display, serif" }}>
            Wholesale Markets Manager
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Publish, update, and audit real-time agricultural commodity prices. Direct sync to client portal.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="p-2 border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-gray-700 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Sync
          </button>
          <button
            onClick={() => setShowAddCommodity(true)}
            className="bg-[#2D6A4F] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#224f3b] transition flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="h-4 w-4" />
            Add Commodity
          </button>
        </div>
      </div>

      {/* Main master-detail view layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Commodities column (Left) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Commodity Registry</span>
              <span className="text-[10px] font-bold bg-[#2D6A4F]/10 text-[#2D6A4F] px-2 py-0.5 rounded-full">
                {commodities.length} Products
              </span>
            </div>

            {loading && commodities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <RefreshCw className="h-6 w-6 text-[#2D6A4F] animate-spin" />
                <span className="text-[10px] text-gray-400 mt-2 font-mono">Fetching database records...</span>
              </div>
            ) : commodities.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400 italic">
                No commodities in the database.
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[550px] overflow-y-auto">
                {commodities.map((comm) => {
                  const isSelected = selectedCommodity?.id === comm.id;
                  const priceCount = comm.entries?.length || 0;
                  return (
                    <div 
                      key={comm.id}
                      onClick={() => setSelectedCommodity(comm)}
                      className={`p-3.5 flex items-center justify-between cursor-pointer transition ${
                        isSelected ? "bg-[#2D6A4F]/5 border-l-4 border-l-[#2D6A4F]" : "hover:bg-gray-50/85"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-gray-900 truncate">{comm.name}</h4>
                          <span className="bg-gray-100 text-gray-500 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                            per {comm.unit}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-medium flex items-center gap-1">
                          <MapPin className="h-3 w-3 inline text-gray-300" />
                          {priceCount > 0 ? `${priceCount} pricing region(s)` : "No pricing regions"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {priceCount > 0 && (
                          <div className="text-right">
                            <span className="text-[10px] font-black font-mono text-[#2D6A4F]">
                              KES {Math.round(comm.entries[0].price).toLocaleString()}
                            </span>
                            <span className="text-[8px] text-gray-400 block font-mono">Latest ({comm.entries[0].region})</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCommodity(comm.id, comm.name);
                          }}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition cursor-pointer"
                          title="Delete commodity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className={`h-4 w-4 text-gray-300 ${isSelected ? "text-[#2D6A4F] translate-x-0.5" : ""} transition-transform`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Price Board / Region details column (Right) */}
        <div className="lg:col-span-7">
          {selectedCommodity ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-fadeIn">
              {/* Header */}
              <div className="px-5 py-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#2D6A4F]">Active Price Board</span>
                  <h3 className="text-sm font-bold text-gray-900 mt-0.5">{selectedCommodity.name} ({selectedCommodity.unit})</h3>
                </div>
                <button
                  onClick={() => setShowAddPrice(true)}
                  className="bg-[#2D6A4F]/10 hover:bg-[#2D6A4F]/20 text-[#2D6A4F] px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Regional Price
                </button>
              </div>

              {/* Table of prices */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50/40 border-b border-gray-100 text-[10px] uppercase font-bold text-gray-400">
                      <th className="py-2.5 px-5">Region</th>
                      <th className="py-2.5 px-5">Source</th>
                      <th className="py-2.5 px-5 text-right">Price</th>
                      <th className="py-2.5 px-5">Recorded At</th>
                      <th className="py-2.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
                    {selectedCommodity.entries && selectedCommodity.entries.length > 0 ? (
                      selectedCommodity.entries.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-5 text-gray-900 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-[#2D6A4F]/70" />
                            {entry.region}
                          </td>
                          <td className="py-3 px-5 text-gray-500 text-[11px]">
                            {entry.source || "Unknown Source"}
                          </td>
                          <td className="py-3 px-5 text-right font-mono font-bold text-[#2D6A4F]">
                            KES {entry.price.toLocaleString()}
                          </td>
                          <td className="py-3 px-5 text-gray-400 text-[10px]">
                            {new Date(entry.recorded_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-5 text-right">
                            <button
                              onClick={() => handleDeletePrice(entry.id)}
                              className="text-red-500 hover:text-red-700 hover:underline text-[10px] font-bold cursor-pointer"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                          No price entries registered for this commodity. Add one above!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm">
              <TrendingUp className="h-8 w-8 text-[#2D6A4F] mx-auto opacity-30 mb-3" />
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">No Commodity Selected</h3>
              <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto">
                Select a commodity from the left registry panel to view or edit its regional wholesale market prices.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: Add Commodity ────────────────────────────────── */}
      {showAddCommodity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-xl max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Add New Commodity Product</h3>
              <button onClick={() => setShowAddCommodity(false)} className="p-1 hover:bg-gray-200 rounded-full cursor-pointer"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            
            <form onSubmit={handleAddCommodity} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dry Maize, Red Onions, Apples"
                  value={newCommName}
                  onChange={(e) => setNewCommName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#2D6A4F] font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Pricing Unit *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 90kg bag, kg, crate, litre"
                  value={newCommUnit}
                  onChange={(e) => setNewCommUnit(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#2D6A4F] font-semibold"
                />
              </div>

              {/* Optional initial price card */}
              <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3 bg-[#FAF9F6]">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-[#2D6A4F]" />
                  <span className="font-bold text-[#2D6A4F] uppercase tracking-wider text-[9px]">Optional Initial Price Entry</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-600 block">Region</label>
                    <input
                      type="text"
                      placeholder="e.g. Nairobi, Eldoret"
                      value={initialRegion}
                      onChange={(e) => setInitialRegion(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none focus:border-[#2D6A4F]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-gray-600 block">Price (KES)</label>
                    <input
                      type="number"
                      placeholder="e.g. 3800"
                      value={initialPrice}
                      onChange={(e) => setInitialPrice(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none focus:border-[#2D6A4F] font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-600 block">Source Agency</label>
                  <input
                    type="text"
                    placeholder="e.g. Wakulima Market, NCPB Depot"
                    value={initialSource}
                    onChange={(e) => setInitialSource(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 outline-none focus:border-[#2D6A4F]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCommodity(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#2D6A4F] text-white px-5 py-2 rounded-lg font-bold hover:bg-[#224f3b] cursor-pointer"
                >
                  Save Commodity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Add Price Entry ──────────────────────────────── */}
      {showAddPrice && selectedCommodity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-xl max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                New Price entry for {selectedCommodity.name}
              </h3>
              <button onClick={() => setShowAddPrice(false)} className="p-1 hover:bg-gray-200 rounded-full cursor-pointer"><X className="h-4 w-4 text-gray-500" /></button>
            </div>
            
            <form onSubmit={handleAddPrice} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Trading Hub Region *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mombasa, Nakuru, Eldoret"
                  value={newPriceRegion}
                  onChange={(e) => setNewPriceRegion(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#2D6A4F] font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Wholesale Price (KES per {selectedCommodity.unit}) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 4200"
                  value={newPriceVal}
                  onChange={(e) => setNewPriceVal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#2D6A4F] font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Price Source / Agency</label>
                <input
                  type="text"
                  placeholder="e.g. Kongowea Market, Ministry of Agriculture"
                  value={newPriceSource}
                  onChange={(e) => setNewPriceSource(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 outline-none focus:border-[#2D6A4F] font-semibold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPrice(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg font-semibold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#2D6A4F] text-white px-5 py-2 rounded-lg font-bold hover:bg-[#224f3b] cursor-pointer"
                >
                  Add Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
