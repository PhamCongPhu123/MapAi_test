import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { validateEmail } from "../utils/validators";
import { 
  Mail, 
  ArrowRight, 
  AlertCircle,
  CheckCircle,
  ArrowLeft
} from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [, setError] = useState("");
  
  const { forgotPassword } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!validateEmail(email)) {
      setError("Địa chỉ email không hợp lệ.");
      addToast("Email không hợp lệ", "error");
      setIsLoading(false);
      return;
    }

    try {
      await forgotPassword(email);
      setIsSent(true);
      addToast("Yêu cầu khôi phục mật khẩu đã được gửi!", "success");
    } catch (err) {
      const msg = err.message || "Đã có lỗi xảy ra.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setIsLoading(false);
    }
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
            <h1 className="text-2xl font-black text-white mb-1.5 tracking-tight">Khôi phục mật khẩu</h1>
            <p className="text-slate-500 font-bold text-[11px] uppercase tracking-[0.1em]">Gửi yêu cầu đặt lại thông tin truy cập</p>
          </div>

          <motion.div 
            className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-7 md:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
          >
            {/* Top Detail Line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>
            
            {!isSent ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="mx-4 text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">Recovery Protocol</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <div className="space-y-3.5">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors w-4 h-4" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email đã đăng ký"
                      className="w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-white/5 rounded-xl focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-800 text-white font-bold text-[13px]"
                    />
                  </div>
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
                      <span>Gửi yêu cầu khôi phục</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                  <CheckCircle size={32} />
                </div>
                <h2 className="text-xl font-black text-white mb-2">Đã gửi yêu cầu!</h2>
                <p className="text-slate-500 text-[12px] font-bold mb-8 leading-relaxed">
                  Vui lòng kiểm tra hộp thư đến của <b className="text-slate-300">{email}</b> để nhận hướng dẫn khôi phục mật khẩu.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/login")}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all text-[12px]"
                >
                  Quay lại đăng nhập
                </motion.button>
              </div>
            )}

            {!isSent && (
              <div className="mt-7 text-center pt-5 border-t border-white/5">
                <button 
                  onClick={() => navigate("/login")} 
                  className="text-slate-500 hover:text-white font-black transition-colors text-[11px] flex items-center justify-center gap-2 mx-auto"
                >
                  <ArrowLeft size={12} /> Quay lại đăng nhập
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
