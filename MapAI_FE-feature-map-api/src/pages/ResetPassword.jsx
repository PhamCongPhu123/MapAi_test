import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { 
  Lock, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  AlertCircle,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { resetPassword } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId || !token) {
      setError("Liên kết không hợp lệ. Vui lòng kiểm tra lại email của bạn.");
    }
  }, [userId, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setIsLoading(true);
    setError("");

    // Fix potential issue where '+' in token is replaced by ' ' by URLSearchParams
    const fixedToken = token ? token.replace(/ /g, '+') : token;

    console.log("Reset Password Payload:", {
      userId,
      token: fixedToken,
      newPassword: " (hidden) "
    });

    try {
      await resetPassword({
        userId,
        token: fixedToken,
        newPassword
      });
      
      setIsSuccess(true);
      addToast("Đặt lại mật khẩu thành công!", "success");
      
      // Auto redirect after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      const msg = err.message || "Liên kết đã hết hạn hoặc không hợp lệ.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-body bg-slate-950 text-slate-200 min-h-screen flex flex-col selection:bg-blue-500/30 overflow-hidden">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 rounded-full blur-[100px]"></div>
      </div>

      <main className="flex-grow flex items-center justify-center px-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[430px]"
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black text-white mb-1.5 tracking-tight">Thiết lập mật khẩu mới</h1>
            <p className="text-slate-500 font-bold text-[11px] uppercase tracking-[0.1em]">Khôi phục quyền truy cập hệ thống</p>
          </div>

          <motion.div 
            className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-7 md:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
            
            {isSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 className="text-emerald-500 w-8 h-8" />
                  </div>
                </div>
                <h3 className="text-white font-black text-lg">Thành công!</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Mật khẩu của bạn đã được cập nhật. Hệ thống sẽ tự động chuyển hướng về trang đăng nhập sau vài giây.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/login")}
                  className="w-full py-3 bg-white text-slate-950 font-black rounded-xl text-sm transition-all"
                >
                  Đăng nhập ngay
                </motion.button>
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl flex items-center gap-3 text-rose-400 text-[11px] font-bold"
                  >
                    <AlertCircle size={14} className="shrink-0" /> {error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-4">
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        disabled={!userId || !token || isLoading}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mật khẩu mới"
                        className="w-full pl-11 pr-11 py-3.5 bg-slate-950/50 border border-white/5 rounded-xl focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-800 text-white font-bold text-[13px] disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div className="relative group">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        disabled={!userId || !token || isLoading}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Xác nhận mật khẩu mới"
                        className="w-full pl-11 pr-11 py-3.5 bg-slate-950/50 border border-white/5 rounded-xl focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-800 text-white font-bold text-[13px] disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <motion.button
                    disabled={isLoading || !userId || !token}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-xl shadow-blue-600/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50 text-[13px]"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Cập nhật mật khẩu</span>
                        <ArrowRight size={16} />
                      </> 
                    )}
                  </motion.button>
                </form>
              </div>
            )}
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
