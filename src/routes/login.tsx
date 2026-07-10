import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Lock, Mail, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { loginAdmin, getAdminCurrentUser } from "@/lib/auth-admin";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Admin Login · Mqulima" },
      { name: "description", content: "Mqulima Admin Console authentication." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await getAdminCurrentUser();
        if (currentUser && ["super_admin", "admin"].includes(currentUser.role)) {
          navigate({ to: "/", replace: true });
        }
      } catch (err) {
        // Ignore
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await loginAdmin({ data: { email, password } });
      if (response && response.success) {
        toast.success("Welcome to the Admin Console");
        navigate({ to: "/", replace: true });
      } else {
        toast.error(response?.error || "Invalid login credentials or permission denied");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F7F7F5]">
        <RefreshCw className="h-8 w-8 text-[#2D6A4F] animate-spin" />
        <span className="text-xs text-gray-400 mt-2 font-mono">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] py-12 px-4 sm:px-6 lg:px-8" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl border border-gray-200 shadow-md">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 bg-[#2D6A4F] items-center justify-center border border-[#F5A623] text-white font-bold text-xl mb-4">
            M
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>
            Admin Console Login
          </h2>
          <p className="mt-2 text-xs text-gray-500">
            Secure administrator gateway
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Admin Email
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-[#2D6A4F] transition">
              <Mail className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mqulima.co.ke"
                className="flex-1 bg-transparent text-sm outline-none text-gray-800"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Secure Password
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-[#2D6A4F] transition">
              <Lock className="h-4 w-4 text-gray-400 shrink-0" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 bg-transparent text-sm outline-none text-gray-800"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-[#2D6A4F] hover:bg-[#224f3b] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D6A4F] transition shadow-md disabled:opacity-70 cursor-pointer"
            >
              {loading ? "Verifying..." : "Sign In to Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
