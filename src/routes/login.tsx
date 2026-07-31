import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Lock, Mail, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { loginAdmin, getAdminCurrentUser } from "@/lib/auth-admin";
import { MqulimaLogo } from "@/components/MqulimaLogo";

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
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: "url('/agriculture-bg.png')", fontFamily: "Inter, sans-serif" }}>
      <div className="w-full min-h-screen flex items-center justify-center bg-black/45 backdrop-blur-xs py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-[#FCFAF2] rounded-[32px] overflow-hidden shadow-2xl border border-white/20 flex flex-col">
          {/* Logo container */}
          <div className="pt-12 pb-8 text-center flex flex-col items-center">
            <MqulimaLogo size={68} />
          </div>
          
          {/* Wave/Curve Section */}
          <div className="bg-[#2D6A4F] rounded-t-[36px] px-8 pt-8 pb-10 flex-1 flex flex-col justify-between shadow-inner">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-extrabold text-[#FCFAF2]" style={{ fontFamily: "Playfair Display, serif" }}>
                Admin Log In
              </h2>
              <p className="text-[10px] uppercase tracking-wider text-[#FCFAF2]/60 mt-1 font-bold">
                Secure administrator gateway
              </p>
            </div>
            
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="bg-[#FCFAF2] rounded-2xl px-4 py-2.5 border border-transparent focus-within:border-[#F5A623] transition shadow-sm">
                <label className="block text-[9px] font-black uppercase tracking-wider text-[#2D6A4F] mb-0.5">
                  Admin Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#2D6A4F]/60 shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Mqulima001@gmail.com"
                    className="w-full bg-transparent text-xs outline-none text-gray-800 font-medium placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              <div className="bg-[#FCFAF2] rounded-2xl px-4 py-2.5 border border-transparent focus-within:border-[#F5A623] transition shadow-sm">
                <label className="block text-[9px] font-black uppercase tracking-wider text-[#2D6A4F] mb-0.5">
                  Secure Password
                </label>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#2D6A4F]/60 shrink-0" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-xs outline-none text-gray-800 font-medium placeholder-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="text-[#2D6A4F]/60 hover:text-[#2D6A4F] focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#FCFAF2]/80 px-1 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="rounded border-transparent text-[#2D6A4F] focus:ring-0 bg-[#FCFAF2]/20 h-3.5 w-3.5" 
                  />
                  <span>Remember me</span>
                </label>
                <span className="hover:underline cursor-pointer">Forgot password?</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#112217] hover:bg-[#1c3525] text-[#FCFAF2] font-black uppercase tracking-wider text-xs rounded-2xl transition shadow-lg disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? "Verifying Access..." : "Log In to Console"}
              </button>
            </form>
            
            <div className="text-center mt-6 pt-4 border-t border-[#FCFAF2]/10">
              <span className="text-[9px] uppercase tracking-widest text-[#FCFAF2]/40">
                Secured by Mqulima Hub
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
