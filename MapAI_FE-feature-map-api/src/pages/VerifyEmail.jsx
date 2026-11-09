import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authApi } from '../services/authService';
import { useToast } from '../hooks/useToast';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const verification = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      const userId = searchParams.get('userId');
      const token = searchParams.get('token');

      if (!userId || !token) {
        setStatus('error');
        setMessage('Liên kết xác thực không hợp lệ hoặc đã hết hạn.');
        return;
      }

      // Restore Base64 '+' characters: Browser decodes '+' in URL to space ' '
      const fixedToken = token.replace(/ /g, '+');

      try {
        // StrictMode replays effects in development. Reuse the same request so
        // a one-use verification token is not submitted twice.
        const key = JSON.stringify([userId, fixedToken]);
        if (verification.current?.key !== key) {
          verification.current = { key, promise: authApi.verifyEmail(userId, fixedToken) };
        }
        await verification.current.promise;
        if (cancelled) return;
        setStatus('success');
        setMessage('Tài khoản của bạn đã được kích hoạt thành công! Giờ đây bạn có thể đăng nhập vào hệ thống.');
        addToast('Xác thực email thành công!', 'success');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error.message || 'Đã có lỗi xảy ra trong quá trình xác thực.');
        addToast(error.message || 'Xác thực thất bại', 'error');
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [searchParams, addToast]);

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

        <p className="text-slate-400 font-medium leading-relaxed mb-8">
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
