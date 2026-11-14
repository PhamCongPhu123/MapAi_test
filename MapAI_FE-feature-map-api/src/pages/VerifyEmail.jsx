import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authApi } from '../services/authService';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  // Restore '+' in links from older backends which did not URL-encode Base64.
  const token = searchParams.get('token')?.replace(/ /g, '+');
  const key = JSON.stringify([userId, token]);
  const [outcome, setOutcome] = useState(null);
  const verification = useRef(null);
  const hasLink = Boolean(userId && token);
  const status = !hasLink ? 'error' : outcome?.key === key ? outcome.status : 'loading';
  const message = !hasLink ? 'Liên kết xác thực không hợp lệ. Vui lòng kiểm tra lại email.'
    : outcome?.key === key ? outcome.message : '';

  useEffect(() => {
    if (!userId || !token) return;
    let cancelled = false;
    const verify = async () => {
      try {
        // StrictMode replays effects in development. Reuse the same request so
        // a verification link is not submitted twice by this component.
        if (verification.current?.key !== key) {
          verification.current = { key, promise: authApi.verifyEmail(userId, token) };
        }
        await verification.current.promise;
        if (cancelled) return;
        setOutcome({ key, status: 'success', message: 'Email đã được xác thực thành công! Bạn có thể đăng nhập ngay.' });
      } catch (error) {
        if (cancelled) return;
        setOutcome({ key, status: 'error', message: error.message || 'Đã có lỗi xảy ra trong quá trình xác thực.' });
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [userId, token, key]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-blue-600/5 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/5 rounded-full blur-[100px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[500px] bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-10 text-center"
      >
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>

        <div className="mb-8 flex justify-center">
          {status === 'loading' && (
            <div className="p-4 bg-blue-500/10 rounded-full">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="p-4 bg-emerald-500/10 rounded-full">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
            </div>
          )}
          {status === 'error' && (
            <div className="p-4 bg-rose-500/10 rounded-full">
              <XCircle className="w-12 h-12 text-rose-500" />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-black text-white mb-4 tracking-tight uppercase italic">
          {status === 'loading' && 'Đang xác thực tài khoản'}
          {status === 'success' && 'Xác thực thành công'}
          {status === 'error' && 'Xác thực thất bại'}
        </h1>

        <p role={status === 'error' ? 'alert' : 'status'} className="text-slate-400 font-medium leading-relaxed mb-8">
          {message || 'Vui lòng đợi trong giây lát khi chúng tôi xử lý yêu cầu của bạn...'}
        </p>

        {status !== 'loading' && (
          <motion.div className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Link 
              to="/login"
              state={status === 'success' ? { verificationMessage: 'Email đã được xác thực thành công. Bạn có thể đăng nhập.' } : undefined}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-xl shadow-blue-600/20 transition-all text-[13px] uppercase tracking-wider"
            >
              <span>Đi đến Đăng nhập</span>
              <ArrowRight size={16} />
            </Link>
            {status === 'error' && <p className="text-sm text-slate-400">Bạn có thể gửi lại email xác thực từ trang đăng nhập.</p>}
          </motion.div>
        )}

        <div className="mt-10 pt-6 border-t border-white/5">
          <p className="text-slate-600 font-bold text-[10px] uppercase tracking-[0.2em]">MapAI Neural System v2.0</p>
        </div>
      </motion.div>
    </div>
  );
}
