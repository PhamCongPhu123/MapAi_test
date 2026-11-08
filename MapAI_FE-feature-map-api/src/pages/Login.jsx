import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { GoogleLogin } from "@react-oauth/google";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle,
  ShieldCheck,
  Check
} from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  
  const { login, googleLogin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page user was trying to access before being redirected to login
  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const userData = await login(email, password);
      addToast("Đăng nhập hệ thống thành công!", "success");
      
      // Redirect to admin dashboard if role is Admin
      if (userData?.role === 'Admin' || userData?.role == 0) {
        navigate("/admin/dashboard", { replace: true });
      } else {
        // Redirect to the intended page or home
        navigate(from, { replace: true });
      }
    } catch (err) {
      const msg = err.message || "Đã có lỗi xảy ra khi đăng nhập.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError("");
    try {
      const idToken = credentialResponse.credential;
      const response = await googleLogin(idToken);
      addToast("Đăng nhập Google thành công!", "success");
      
      if (response.isRegistered === false) {
        navigate("/profile");
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const msg = err.message || "Đăng nhập Google thất bại.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Đăng nhập Google thất bại.");
    addToast("Đăng nhập Google thất bại.", "error");
  };

  return (
    <div className="font-body bg-slate-950 text-slate-200 min-h-full flex flex-col selection:bg-blue-500/30 overflow-hidden">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 rounded-full blur-[100px]"></div>
      </div>

      <main className="flex-grow flex items-center justify-center pt-12 pb-12 px-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[430px]"
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black text-white mb-1.5 tracking-tight">Xác thực quyền truy cập</h1>
            <p className="text-slate-500 font-bold text-[11px] uppercase tracking-[0.1em]">Hệ thống bản đồ Neural Mapping v2.0</p>
          </div>

          <motion.div 
            animate={error ? { x: [-4, 4, -4, 4, 0] } : {}}
            className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-7 md:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
          >
            {/* Top Detail Line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
            
            <div className="space-y-5">
              <div className="flex justify-center w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap
                  use_fedcm_for_prompt={false}
                  theme="filled_blue"
                  width="350px"
                 shape="pill"
                />
              </div>

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="mx-4 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">MapAI Credential</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-rose-500/5 border border-rose-500/20 p-2.5 rounded-lg flex items-center gap-2 text-rose-400 text-[10px] font-bold"
                  >
                    <AlertCircle size={12} /> {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-3.5">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-white/5 rounded-xl focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-800 text-white font-bold text-[13px]"
                    />
                  </div>

                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mật khẩu"
                      className="w-full pl-11 pr-11 py-3 bg-slate-950/50 border border-white/5 rounded-xl focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-800 text-white font-bold text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div 
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-4 h-4 rounded border border-white/10 flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-white/5 group-hover:bg-white/10'}`}
                    >
                      {rememberMe && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 select-none">Duy trì đăng nhập</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-[10px] font-black text-blue-500 hover:text-blue-400 flex items-center gap-1"
                  >
                    <ShieldCheck size={10} /> Quên mật khẩu?
                  </button>
                </div>

                <motion.button
                  disabled={isLoading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-xl shadow-blue-600/20 transition-all flex justify-center items-center gap-2 disabled:opacity-70 text-[13px]"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Truy cập Neural Map</span>
                      <ArrowRight size={14} />
                    </> 
                  )}
                </motion.button>
              </form>
            </div>

            <div className="mt-7 text-center pt-5 border-t border-white/5">
              <p className="text-slate-500 font-bold text-[11px]">
                Chưa có tài khoản hệ thống?
                <button 
                  onClick={() => navigate("/register")} 
                  className="text-white ml-2 hover:text-blue-500 font-black transition-colors"
                >
                  Yêu cầu cấp quyền
                </button>
              </p>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
